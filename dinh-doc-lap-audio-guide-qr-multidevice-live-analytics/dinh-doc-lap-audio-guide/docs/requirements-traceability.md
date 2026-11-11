# Use-case traceability (report baseline)

This document maps the 14 use cases in `Bao_cao_qua_trinh_Dinh_Doc_Lap_Audio_Guide.docx` to the current web MVP. It is an implementation checklist, not a claim that device testing or production deployment has passed.

| ID     | Use case                            | Current implementation                                                                                                                                                                                         | Verification still required                                                   |
| ------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| UC-V01 | View attraction list                | Public React catalogue calls Attraction API                                                                                                                                                                    | Compose integration test covers Gateway-to-PostgreSQL API response            |
| UC-V02 | View attraction details             | Detail route by POI ID                                                                                                                                                                                         | Verify missing/hidden POI states                                              |
| UC-V03 | Select language                     | VI/EN toggle and persisted locale                                                                                                                                                                              | Check every label and content fallback                                        |
| UC-V04 | Listen manually                     | Browser Web Speech API with explicit Play; transcript visible                                                                                                                                                  | Test real Android/iOS browsers and voices                                     |
| UC-V05 | Location-triggered narration        | Opt-in geolocation, proximity trigger, per-session anti-repeat, manual fallback                                                                                                                                | Test permission denial, GPS jitter and autoplay policy on devices             |
| UC-V06 | View map and visit routes           | Leaflet/OSM markers and route listing                                                                                                                                                                          | Test map tile failure fallback and route order                                |
| UC-V07 | Track visit progress                | Local-device visited list, progress indicator and anonymous `visit_marked` analytics events                                                                                                                    | Progress itself is still local to the browser; confirm completion/reset rules |
| UC-V08 | Submit rating and feedback          | Validated feedback form and backend persistence                                                                                                                                                                | Test invalid payloads and dependency outage                                   |
| UC-A01 | Administrator login                 | JWT login, bcrypt password verification                                                                                                                                                                        | Compose integration test covers configured login and protected admin endpoints |
| UC-A02 | Manage attractions                  | Admin create/edit/hide and visibility controls                                                                                                                                                                 | Test authorization and publication edge cases                                 |
| UC-A03 | Manage narration/translations/audio | Admin edits VI/EN scripts and publication status; TTS fallback                                                                                                                                                 | Audio upload is not implemented; verify draft cannot leak                     |
| UC-A04 | Manage visit routes                 | Admin create/edit ordered route stops                                                                                                                                                                          | Test invalid/hidden references and ordering                                   |
| UC-A05 | Handle feedback                     | Admin list and status transitions                                                                                                                                                                              | Test role restrictions and failure states                                     |
| UC-A06 | View statistics                     | Analytics Service + admin dashboard: anonymous visitors/listeners, QR-link opens, listening starts/completions, language preference, attraction totals, daily activity and recent visitor-by-attraction events | Compose integration test covers event persistence and admin summary; review retention/privacy policy |

## Deliberate scope boundaries

- Delivery is a responsive, mobile-first web application, not a native Android/iOS package.
- Visitor sign-in is not required for core browsing.
- QR-code generation and basic event analytics are incremental additions beyond the initial MVP baseline. The visitor scans using the phone camera and opens a browser URL; no in-app camera scanner is required. Offline audio/PWA, media uploads, advanced cohort analytics and cross-device server-synced progress remain out of scope.
- Sample narration is not certified historical content; review it against official on-site materials before public use.
- CI/CD workflows are configured but require a GitHub repository, successful workflow runs and (for remote deployment) GitHub Secrets/server setup before deployment can be claimed complete.

## Added scope: QR and analytics

- Admin QR manager creates a QR URL per published attraction; the mobile camera opens the public detail page directly. `source=qr` logs a QR-link open, not proof of physical presence.
- Analytics uses a browser-generated pseudonymous UUID. No visitor name, email or GPS coordinates are collected for these events.
- “Visited” in analytics means the visitor pressed the existing Mark as visited button; QR open, place-page view, narration start and narration completion are counted as separate event types.

## Automated integration checks

`node --test scripts/integration.test.mjs` verifies the live Compose stack, including database-backed attraction/tour reads, narration reads and admin updates, login/JWT authorization, feedback persistence, analytics event/summary, malformed JSON, validation, and 404 error responses. CI builds and starts an isolated Compose project before running this test and removes its database volume afterward. Run locally only with a disposable project as described in [`api.md`](./api.md).
