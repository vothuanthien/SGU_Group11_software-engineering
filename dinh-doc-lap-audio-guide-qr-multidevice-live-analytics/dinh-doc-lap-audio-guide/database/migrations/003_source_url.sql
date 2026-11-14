-- Preserve custom references; replace only the legacy URL.
UPDATE attractions
SET source_url = 'https://dinhdoclap.gov.vn/'
WHERE source_url IN (
  'https://independencepalace.gov.vn/',
  'https://independencepalace.gov.vn',
  'http://independencepalace.gov.vn/',
  'http://independencepalace.gov.vn'
);
