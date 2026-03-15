# GeoTrack

GeoTrack is a geo-fenced mobile attendance monitoring system built for academic institutions. The platform ensures that students can only mark attendance when they are physically present within a designated lecture location using GPS verification, device binding, and backend validation.

The system addresses common issues in traditional attendance processes such as impersonation, inaccurate records, and manual tracking by leveraging mobile location sensing and secure backend services.

---

## Problem Statement

Traditional attendance systems rely heavily on manual processes such as roll calls or paper sign-in sheets. These approaches introduce several challenges:

- Attendance fraud through impersonation
- Time-consuming roll calls
- Inaccurate attendance records
- Lack of real-time monitoring
- Difficulty managing attendance data at scale

GeoTrack provides a modern digital solution that verifies both **student identity** and **physical presence** before attendance can be recorded.

---

## Core Features

### Geo-Fenced Attendance

Attendance can only be recorded when a student is physically located within a predefined lecture boundary.

### Device Binding

Each user account is associated with a specific device to prevent attendance spoofing.

### Lecturer-Controlled Attendance Sessions

Lecturers can create and manage attendance sessions with configurable time windows and geofence boundaries.

### Presence Verification

Randomized checks can be triggered during lecture sessions to confirm continued presence.

### Secure Attendance Logs

All attendance records are stored and processed securely through backend services.

### Real-Time Monitoring

Lecturers can track attendance activity during active lecture sessions.

---

## System Architecture

GeoTrack follows a **three-tier architecture** to ensure scalability, maintainability, and separation of concerns.

### 1. Presentation Layer

Mobile application used by students and lecturers.

Responsibilities:

- User authentication
- GPS location capture
- Attendance interaction
- Communication with backend APIs

### 2. Application Layer

Backend service responsible for business logic and validation.

Responsibilities:

- Authentication and authorization
- Geofence verification
- Device validation
- Attendance session management
- Data processing and storage

### 3. Data Layer

Persistent storage for system data including:

- User accounts
- Device registrations
- Course sessions
- Attendance records
- Location verification data

---

## Technology Stack

### Mobile Application

- React Native
- TypeScript
- Expo
- NativeWind (Tailwind for React Native)

### Backend

- Laravel (PHP)
- RESTful API architecture

### Database

- MySQL / PostgreSQL

### Infrastructure

- Linux (Ubuntu)
- Nginx / Apache
- HTTPS secured APIs

### External Services

- GPS Location Services
- Geofencing APIs

---

## Project Structure

```
geotrack/
│
├── mobile/                # React Native mobile application
│
├── backend/               # Laravel backend API
│
├── docs/                  # Architecture and documentation
│
└── README.md
```

---

## Getting Started

### Prerequisites

Ensure the following tools are installed:

- Node.js (v18+ recommended)
- npm or yarn
- Expo CLI
- PHP 8+
- Composer
- MySQL or PostgreSQL

---

## Installation

### Clone the Repository

```bash
git clone https://github.com/yourusername/geotrack.git
cd geotrack
```

---

## Mobile Application Setup

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npx expo start
```

Run on Android emulator:

```bash
npx expo run:android
```

---

## Backend Setup

Navigate to the backend directory:

```bash
cd backend
```

Install PHP dependencies:

```bash
composer install
```

Create environment configuration:

```bash
cp .env.example .env
```

Generate application key:

```bash
php artisan key:generate
```

Run database migrations:

```bash
php artisan migrate
```

Start the development server:

```bash
php artisan serve
```

---

## Environment Variables

Example `.env` configuration:

```
API_URL=http://localhost:8000
DB_DATABASE=geotrack
DB_USERNAME=root
DB_PASSWORD=password
GOOGLE_MAPS_API_KEY=your_api_key
```

---

## Security Considerations

GeoTrack includes several security mechanisms to protect attendance data:

- Device-level access control
- Secure API authentication
- Role-based access permissions
- Encrypted communication via HTTPS
- Server-side attendance validation

---

## Development Roadmap

Future improvements planned for the system include:

- Background location monitoring
- Offline attendance synchronization
- AI-based attendance anomaly detection
- Advanced reporting dashboards
- Integration with university student management systems

---

## Contributing

Contributions are welcome.

If you would like to contribute:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Submit a pull request

Please ensure code follows the project's coding standards.

---

## License

This project is licensed under the MIT License.

---

## Author

Abasiama Essien  
Electrical & Electronic Engineering  
Federal University of Agriculture, Abeokuta
