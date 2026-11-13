/*
  Dinh Doc Lap Audio Guide - SQL Server schema
  Safe to re-run: creates the database and tables only when absent.
  Target: SQL Server 2019 or later.
*/
USE master;
GO

IF DB_ID(N'DinhGuide') IS NULL
    CREATE DATABASE [DinhGuide];
GO

USE [DinhGuide];
GO

IF OBJECT_ID(N'dbo.users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.users (
        id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_users_id DEFAULT NEWSEQUENTIALID(),
        email NVARCHAR(320) NOT NULL,
        password_hash NVARCHAR(255) NOT NULL,
        role NVARCHAR(20) NOT NULL CONSTRAINT DF_users_role DEFAULT N'visitor',
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_users_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_users PRIMARY KEY (id),
        CONSTRAINT UQ_users_email UNIQUE (email),
        CONSTRAINT CK_users_role CHECK (role IN (N'visitor', N'admin'))
    );
END;
GO

IF OBJECT_ID(N'dbo.attractions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.attractions (
        id NVARCHAR(100) NOT NULL,
        name_vi NVARCHAR(300) NOT NULL,
        name_en NVARCHAR(300) NOT NULL,
        description_vi NVARCHAR(MAX) NOT NULL,
        description_en NVARCHAR(MAX) NOT NULL,
        narration_vi NVARCHAR(MAX) NOT NULL,
        narration_en NVARCHAR(MAX) NOT NULL,
        narration_zh NVARCHAR(MAX) NULL,
        narration_th NVARCHAR(MAX) NULL,
        area_vi NVARCHAR(200) NOT NULL CONSTRAINT DF_attractions_area_vi DEFAULT N'Khuôn viên',
        area_en NVARCHAR(200) NOT NULL CONSTRAINT DF_attractions_area_en DEFAULT N'Grounds',
        latitude FLOAT NULL,
        longitude FLOAT NULL,
        sort_order INT NOT NULL CONSTRAINT DF_attractions_sort_order DEFAULT 0,
        duration_minutes INT NOT NULL CONSTRAINT DF_attractions_duration DEFAULT 2,
        image_url NVARCHAR(2048) NULL,
        source_url NVARCHAR(2048) NULL,
        visible BIT NOT NULL CONSTRAINT DF_attractions_visible DEFAULT 1,
        narration_published BIT NOT NULL CONSTRAINT DF_attractions_narration_published DEFAULT 1,
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_attractions_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_attractions PRIMARY KEY (id),
        CONSTRAINT CK_attractions_duration CHECK (duration_minutes > 0)
    );
    CREATE INDEX IX_attractions_visible_order ON dbo.attractions(visible, sort_order);
END;
GO

IF OBJECT_ID(N'dbo.tours', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tours (
        id NVARCHAR(100) NOT NULL,
        name_vi NVARCHAR(300) NOT NULL,
        name_en NVARCHAR(300) NOT NULL,
        description_vi NVARCHAR(MAX) NOT NULL,
        description_en NVARCHAR(MAX) NOT NULL,
        CONSTRAINT PK_tours PRIMARY KEY (id)
    );
END;
GO

IF OBJECT_ID(N'dbo.tour_stops', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tour_stops (
        tour_id NVARCHAR(100) NOT NULL,
        attraction_id NVARCHAR(100) NOT NULL,
        stop_order INT NOT NULL,
        CONSTRAINT PK_tour_stops PRIMARY KEY (tour_id, attraction_id),
        CONSTRAINT UQ_tour_stops_order UNIQUE (tour_id, stop_order),
        CONSTRAINT FK_tour_stops_tours FOREIGN KEY (tour_id) REFERENCES dbo.tours(id) ON DELETE CASCADE,
        CONSTRAINT FK_tour_stops_attractions FOREIGN KEY (attraction_id) REFERENCES dbo.attractions(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'dbo.feedback', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.feedback (
        id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_feedback_id DEFAULT NEWSEQUENTIALID(),
        attraction_id NVARCHAR(100) NULL,
        rating TINYINT NULL,
        message NVARCHAR(1000) NOT NULL,
        type NVARCHAR(20) NOT NULL CONSTRAINT DF_feedback_type DEFAULT N'review',
        status NVARCHAR(20) NOT NULL CONSTRAINT DF_feedback_status DEFAULT N'new',
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_feedback_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_feedback PRIMARY KEY (id),
        CONSTRAINT FK_feedback_attractions FOREIGN KEY (attraction_id) REFERENCES dbo.attractions(id),
        CONSTRAINT CK_feedback_rating CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
        CONSTRAINT CK_feedback_type CHECK (type IN (N'review', N'accuracy', N'audio', N'location')),
        CONSTRAINT CK_feedback_status CHECK (status IN (N'new', N'reviewing', N'resolved'))
    );
    CREATE INDEX IX_feedback_created ON dbo.feedback(created_at DESC);
END;
GO

IF OBJECT_ID(N'dbo.narration_assets', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.narration_assets (
        id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_narration_assets_id DEFAULT NEWSEQUENTIALID(),
        attraction_id NVARCHAR(100) NOT NULL,
        language NVARCHAR(2) NOT NULL,
        audio_url NVARCHAR(2048) NULL,
        updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_narration_assets_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_narration_assets PRIMARY KEY (id),
        CONSTRAINT FK_narration_assets_attractions FOREIGN KEY (attraction_id) REFERENCES dbo.attractions(id) ON DELETE CASCADE,
        CONSTRAINT UQ_narration_assets_attraction_language UNIQUE (attraction_id, language),
        CONSTRAINT CK_narration_assets_language CHECK (language IN (N'vi', N'en', N'zh', N'th'))
    );
END;
GO

IF OBJECT_ID(N'dbo.visitor_events', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.visitor_events (
        id BIGINT IDENTITY(1,1) NOT NULL,
        visitor_id UNIQUEIDENTIFIER NOT NULL,
        event_type NVARCHAR(40) NOT NULL,
        attraction_id NVARCHAR(100) NULL,
        language NVARCHAR(2) NOT NULL,
        metadata NVARCHAR(MAX) NOT NULL CONSTRAINT DF_visitor_events_metadata DEFAULT N'{}',
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_visitor_events_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_visitor_events PRIMARY KEY (id),
        CONSTRAINT FK_visitor_events_attractions FOREIGN KEY (attraction_id) REFERENCES dbo.attractions(id) ON DELETE CASCADE,
        CONSTRAINT CK_visitor_events_type CHECK (event_type IN (N'app_opened', N'qr_scan', N'place_opened', N'visit_marked', N'narration_started', N'narration_completed')),
        CONSTRAINT CK_visitor_events_language CHECK (language IN (N'vi', N'en', N'zh', N'th')),
        CONSTRAINT CK_visitor_events_metadata_json CHECK (ISJSON(metadata) = 1)
    );
    CREATE INDEX IX_visitor_events_created_at ON dbo.visitor_events(created_at DESC);
    CREATE INDEX IX_visitor_events_visitor_created ON dbo.visitor_events(visitor_id, created_at DESC);
    CREATE INDEX IX_visitor_events_attraction_type ON dbo.visitor_events(attraction_id, event_type, created_at DESC);
END;
GO

IF OBJECT_ID(N'dbo.sync_state', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.sync_state (
        sync_name NVARCHAR(100) NOT NULL,
        last_visitor_event_id BIGINT NOT NULL CONSTRAINT DF_sync_state_event_id DEFAULT 0,
        updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_sync_state_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_sync_state PRIMARY KEY (sync_name)
    );
END;
GO

PRINT N'Đã tạo schema SQL Server cho DinhGuide.';
GO
