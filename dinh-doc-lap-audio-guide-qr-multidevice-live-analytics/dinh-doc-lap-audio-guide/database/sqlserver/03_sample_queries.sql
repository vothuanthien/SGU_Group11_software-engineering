USE [DinhGuide];
GO

-- 1. Danh sách địa điểm đang hiển thị.
SELECT id, name_vi, name_en, area_vi, duration_minutes, source_url
FROM dbo.attractions
WHERE visible = 1
ORDER BY sort_order;

-- 2. Lộ trình và thứ tự các điểm dừng.
SELECT t.name_vi AS tour_name, ts.stop_order, a.id, a.name_vi, a.area_vi
FROM dbo.tours AS t
JOIN dbo.tour_stops AS ts ON ts.tour_id = t.id
JOIN dbo.attractions AS a ON a.id = ts.attraction_id
WHERE t.id = N'highlights'
ORDER BY ts.stop_order;

-- 3. Các địa điểm có nội dung thuyết minh đã công bố.
SELECT id, name_vi, narration_vi, narration_en
FROM dbo.attractions
WHERE visible = 1 AND narration_published = 1
ORDER BY sort_order;

-- 4. Thống kê sự kiện theo loại trong 30 ngày gần nhất.
SELECT event_type, COUNT_BIG(*) AS event_count
FROM dbo.visitor_events
WHERE created_at >= DATEADD(DAY, -30, SYSUTCDATETIME())
GROUP BY event_type
ORDER BY event_count DESC;

-- 5. Lượt nghe và lượt đánh dấu tham quan theo địa điểm trong 30 ngày.
SELECT a.id, a.name_vi,
       SUM(CASE WHEN e.event_type = N'narration_started' THEN CONVERT(BIGINT,1) ELSE 0 END) AS listens_started,
       SUM(CASE WHEN e.event_type = N'narration_completed' THEN CONVERT(BIGINT,1) ELSE 0 END) AS listens_completed,
       SUM(CASE WHEN e.event_type = N'visit_marked' THEN CONVERT(BIGINT,1) ELSE 0 END) AS visits_marked
FROM dbo.attractions AS a
LEFT JOIN dbo.visitor_events AS e
  ON e.attraction_id = a.id
 AND e.created_at >= DATEADD(DAY, -30, SYSUTCDATETIME())
WHERE a.visible = 1
GROUP BY a.id, a.name_vi, a.sort_order
ORDER BY listens_started DESC, visits_marked DESC, a.sort_order;

-- 6. Phản hồi mới nhất.
SELECT TOP (100) f.id, a.name_vi, f.rating, f.type, f.status, f.message, f.created_at
FROM dbo.feedback AS f
LEFT JOIN dbo.attractions AS a ON a.id = f.attraction_id
ORDER BY f.created_at DESC;

-- 7. Trạng thái đồng bộ gần nhất từ PostgreSQL.
SELECT sync_name, last_visitor_event_id, updated_at
FROM dbo.sync_state
WHERE sync_name = N'postgres-to-sqlserver';
GO
