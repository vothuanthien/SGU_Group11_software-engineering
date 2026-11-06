/* Idempotent seed for the website's public attraction and tour content. */
USE [DinhGuide];
GO
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @Attractions TABLE (
    id NVARCHAR(100) PRIMARY KEY,
    name_vi NVARCHAR(300), name_en NVARCHAR(300),
    description_vi NVARCHAR(MAX), description_en NVARCHAR(MAX),
    narration_vi NVARCHAR(MAX), narration_en NVARCHAR(MAX),
    area_vi NVARCHAR(200), area_en NVARCHAR(200),
    latitude FLOAT, longitude FLOAT, sort_order INT, duration_minutes INT,
    source_url NVARCHAR(2048)
);

INSERT INTO @Attractions VALUES
(N'main-building',N'Tòa nhà chính',N'Main Building',N'Công trình trung tâm của Dinh Độc Lập.',N'The central building of Independence Palace.',N'Dinh Độc Lập là một công trình kiến trúc nổi bật tại Thành phố Hồ Chí Minh, gắn với nhiều dấu mốc quan trọng của lịch sử Việt Nam hiện đại. Khi tham quan, bạn hãy chú ý bố cục tổng thể, các khoảng sân và sự kết nối giữa không gian trong nhà với khuôn viên. Nội dung này là phần giới thiệu mẫu và cần được đối chiếu với thuyết minh chính thức.',N'Independence Palace is a prominent landmark in Ho Chi Minh City associated with important moments in modern Vietnamese history. As you explore, notice the overall layout, courtyards, and the relationship between the interior spaces and the grounds. This is sample introductory narration and should be checked against official visitor materials.',N'Tòa nhà chính',N'Main Building',10.7769,106.6953,1,3,N'https://dinhdoclap.gov.vn/kien-truc-dinh-doc-lap/'),
(N'front-lawn',N'Thảm cỏ phía trước',N'Front Lawn',N'Không gian mở phía trước công trình.',N'The open lawn in front of the building.',N'Thảm cỏ phía trước tạo khoảng nhìn rộng hướng về mặt tiền công trình. Đây cũng là nơi dễ quan sát hình khối kiến trúc và trục tiếp cận chính. Hãy di chuyển theo lối dành cho khách tham quan và tuân thủ hướng dẫn tại chỗ.',N'The front lawn creates an open view toward the building facade. It is a good place to observe the architecture and the main approach. Please use visitor paths and follow on-site instructions.',N'Khuôn viên',N'Grounds',10.7764,106.6951,2,2,N'https://dinhdoclap.gov.vn/kien-truc-dinh-doc-lap/'),
(N'helicopter-pad',N'Sân đáp trực thăng',N'Helicopter Pad',N'Khu vực sân thượng có sân đáp trực thăng.',N'The rooftop area featuring a helicopter pad.',N'Sân đáp trực thăng là một chi tiết dễ nhận biết trong hình ảnh về Dinh Độc Lập. Khi tìm hiểu khu vực này, hãy tham khảo bảng thông tin tại điểm trưng bày để biết thêm bối cảnh và công năng của không gian.',N'The helicopter pad is a recognizable feature in photographs of Independence Palace. Consult the exhibit information on site for additional context about this space and its use.',N'Tầng thượng',N'Rooftop',10.7770,106.6955,3,2,N'https://dinhdoclap.gov.vn/kien-truc-dinh-doc-lap/'),
(N'conference-room',N'Phòng khánh tiết',N'Ceremonial Hall',N'Không gian tiếp đón và tổ chức sự kiện.',N'A space used for receptions and events.',N'Phòng khánh tiết là một trong những không gian tiêu biểu phục vụ hoạt động tiếp đón và nghi lễ. Khi quan sát nội thất, bạn có thể chú ý cách bố trí chỗ ngồi, ánh sáng và các chi tiết trang trí. Vui lòng kiểm tra chú giải chính thức để xác định chính xác niên đại và chức năng từng hạng mục.',N'The ceremonial hall is a representative space for receptions and formal events. Notice the seating arrangement, lighting, and decorative details. Please consult official exhibit labels for precise dates and functions of individual features.',N'Tầng 1',N'Floor 1',10.7768,106.6954,4,2,N'https://dinhdoclap.gov.vn/kien-truc-dinh-doc-lap/'),
(N'cabinet-room',N'Phòng họp nội các',N'Cabinet Room',N'Không gian gắn với hoạt động họp và điều hành.',N'A room associated with meetings and administration.',N'Phòng họp cho thấy một khía cạnh trong cách tổ chức công việc của bộ máy chính quyền thời kỳ trước. Bố trí bàn ghế và các vật dụng trưng bày giúp hình dung không khí làm việc của một cuộc họp. Hãy dựa vào bảng thuyết minh tại chỗ để tìm hiểu các sự kiện cụ thể.',N'The meeting room offers a glimpse into the administration and working practices of an earlier period. Its table, seating, and displayed objects help visitors imagine a formal meeting. Refer to the on-site labels for specific historical events.',N'Tầng 1',N'Floor 1',10.7769,106.6952,5,2,N'https://dinhdoclap.gov.vn/kien-truc-dinh-doc-lap/'),
(N'basement',N'Khu tầng hầm',N'Basement',N'Khu vực phục vụ hoạt động liên lạc và điều hành.',N'An area associated with communications and operations.',N'Khu tầng hầm mang đến góc nhìn khác với các phòng nghi lễ phía trên. Các khu vực và thiết bị được giới thiệu tại đây giúp khách tham quan tìm hiểu hoạt động liên lạc, điều hành trong bối cảnh lịch sử. Nội dung chi tiết nên được kiểm chứng theo bảng trưng bày chính thức.',N'The basement provides a contrast to the ceremonial rooms above. Exhibits here help visitors learn about communications and operations in their historical context. Please verify detailed information with the official exhibit labels.',N'Tầng hầm',N'Basement',10.7766,106.6950,6,3,N'https://dinhdoclap.gov.vn/kien-truc-dinh-doc-lap/'),
(N'garden',N'Khuôn viên cây xanh',N'Gardens',N'Khuôn viên có cây xanh bao quanh công trình.',N'Green spaces surrounding the building.',N'Khuôn viên cây xanh tạo môi trường thoáng đãng quanh tòa nhà và góp phần định hình trải nghiệm tham quan. Đây cũng là nơi nghỉ chân phù hợp giữa các điểm trong lộ trình. Hãy đi theo lối quy định và không làm ảnh hưởng đến cảnh quan.',N'The landscaped grounds create an open setting around the building and shape the visitor experience. They can also provide a quiet pause between stops. Please stay on designated paths and help protect the landscape.',N'Khuôn viên',N'Grounds',10.7762,106.6957,7,2,N'https://dinhdoclap.gov.vn/kien-truc-dinh-doc-lap/'),
(N'exhibition',N'Khu trưng bày',N'Exhibition Area',N'Khu vực giới thiệu tư liệu và hình ảnh lịch sử.',N'An area displaying historical documents and photographs.',N'Khu trưng bày giúp bổ sung tư liệu cho những không gian kiến trúc bạn đã đi qua. Khi xem hiện vật, hãy đọc phần chú thích để phân biệt tư liệu gốc, hình ảnh minh họa và nội dung diễn giải. Việc chụp ảnh có thể phụ thuộc quy định của từng khu vực.',N'The exhibition area adds documentary context to the architectural spaces you have visited. Read labels carefully to distinguish original materials, illustrative images, and interpretation. Photography may be subject to area-specific rules.',N'Khu trưng bày',N'Exhibition Area',10.7767,106.6956,8,3,N'https://dinhdoclap.gov.vn/kien-truc-dinh-doc-lap/');

UPDATE a SET
    name_vi=s.name_vi, name_en=s.name_en,
    description_vi=s.description_vi, description_en=s.description_en,
    narration_vi=s.narration_vi, narration_en=s.narration_en,
    area_vi=s.area_vi, area_en=s.area_en,
    latitude=s.latitude, longitude=s.longitude,
    sort_order=s.sort_order, duration_minutes=s.duration_minutes,
    source_url=s.source_url
FROM dbo.attractions AS a JOIN @Attractions AS s ON s.id=a.id;

INSERT INTO dbo.attractions
    (id,name_vi,name_en,description_vi,description_en,narration_vi,narration_en,area_vi,area_en,latitude,longitude,sort_order,duration_minutes,source_url)
SELECT s.id,s.name_vi,s.name_en,s.description_vi,s.description_en,s.narration_vi,s.narration_en,s.area_vi,s.area_en,s.latitude,s.longitude,s.sort_order,s.duration_minutes,s.source_url
FROM @Attractions AS s
WHERE NOT EXISTS (SELECT 1 FROM dbo.attractions AS a WHERE a.id=s.id);

UPDATE dbo.tours SET
    name_vi=N'Lộ trình điểm nổi bật', name_en=N'Highlights Tour',
    description_vi=N'Lộ trình mẫu qua các điểm tiêu biểu.',
    description_en=N'A sample route through selected highlights.'
WHERE id=N'highlights';

IF NOT EXISTS (SELECT 1 FROM dbo.tours WHERE id=N'highlights')
    INSERT INTO dbo.tours(id,name_vi,name_en,description_vi,description_en)
    VALUES(N'highlights',N'Lộ trình điểm nổi bật',N'Highlights Tour',N'Lộ trình mẫu qua các điểm tiêu biểu.',N'A sample route through selected highlights.');

DECLARE @Stops TABLE (attraction_id NVARCHAR(100) PRIMARY KEY, stop_order INT NOT NULL);
INSERT INTO @Stops VALUES
    (N'front-lawn',1),(N'main-building',2),(N'conference-room',3),
    (N'cabinet-room',4),(N'basement',5),(N'garden',6);

DELETE FROM dbo.tour_stops WHERE tour_id=N'highlights';
INSERT INTO dbo.tour_stops(tour_id,attraction_id,stop_order)
SELECT N'highlights', attraction_id, stop_order FROM @Stops;

COMMIT TRANSACTION;
PRINT N'Đã thêm/cập nhật 8 địa điểm và lộ trình điểm nổi bật.';
GO
