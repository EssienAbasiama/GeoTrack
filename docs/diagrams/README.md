# GeoTrack — Diagrams

This folder contains architecture diagrams, flowcharts, and other visual documentation for GeoTrack.

---

## Files

| File                  | Description                                       | Tool                                |
| --------------------- | ------------------------------------------------- | ----------------------------------- |
| `architecture.drawio` | Editable system architecture diagram (three-tier) | [draw.io](https://app.diagrams.net) |
| `flowchart.png`       | Attendance check-in flow diagram (exported image) | draw.io / Figma                     |

---

## How to Edit

1. Open [draw.io](https://app.diagrams.net) in your browser
2. Click **File → Open from → This device**
3. Select the `.drawio` file from this folder
4. Edit as needed and export as PNG/SVG when done
5. Save the updated `.drawio` file back to this folder and commit

---

## Diagram Descriptions

### System Architecture (`architecture.drawio`)

Shows the three-tier architecture:

- **Presentation Layer** — React Native mobile app (students & lecturers)
- **Application Layer** — Laravel REST API (auth, geofence, attendance logic)
- **Data Layer** — MySQL database (users, sessions, records)
- Communication flows between each layer via HTTPS/REST and SQL

### Attendance Flowchart (`flowchart.png`)

Shows the student attendance check-in flow:

1. Student opens app and taps "Check In"
2. App captures GPS coordinates
3. API validates: token → device binding → session active → geofence
4. Attendance recorded or rejected with reason
