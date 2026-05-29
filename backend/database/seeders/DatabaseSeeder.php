<?php

namespace Database\Seeders;

use App\Models\AttendanceSession;
use App\Models\Course;
use App\Models\CourseEnrollment;
use App\Models\CourseGeofence;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Superadmin
        $admin = User::query()->updateOrCreate(
            ['email' => 'admin@geotrack.edu'],
            [
                'name' => 'GeoTrack Admin',
                'password' => 'Password123!',
                'role' => 'superadmin',
                'email_verified_at' => now(),
            ]
        );

        // Lecturers
        $lecturers = collect([
            ['name' => 'Dr. Adebayo Olu', 'email' => 'adebayo.olu@geotrack.edu'],
            ['name' => 'Dr. Funmi Ade', 'email' => 'funmi.ade@geotrack.edu'],
        ])->map(function (array $data) {
            return User::query()->updateOrCreate(
                ['email' => $data['email']],
                [
                    'name' => $data['name'],
                    'password' => 'Password123!',
                    'role' => 'lecturer',
                    'email_verified_at' => now(),
                ]
            );
        });

        // Students
        $studentSeeds = [
            ['name' => 'Chika Eze', 'matric_no' => 'FUNAAB/CSC/2022/001'],
            ['name' => 'Tunde Bello', 'matric_no' => 'FUNAAB/CSC/2022/002'],
            ['name' => 'Amaka Obi', 'matric_no' => 'FUNAAB/CSC/2022/003'],
            ['name' => 'Sade Ojo', 'matric_no' => 'FUNAAB/CSC/2022/004'],
            ['name' => 'Ifeanyi Nwosu', 'matric_no' => 'FUNAAB/CSC/2022/005'],
            ['name' => 'Bola Adeyemi', 'matric_no' => 'FUNAAB/CSC/2022/006'],
        ];
        $students = collect($studentSeeds)->map(function (array $data) {
            $slug = strtolower(str_replace(' ', '.', $data['name']));
            return User::query()->updateOrCreate(
                ['matric_no' => $data['matric_no']],
                [
                    'name' => $data['name'],
                    'email' => $slug . '@students.geotrack.edu',
                    'password' => 'Password123!',
                    'role' => 'student',
                    'email_verified_at' => now(),
                ]
            );
        });

        // Courses
        $courseSeeds = [
            ['code' => 'CSC401', 'title' => 'Software Engineering', 'department' => 'Computer Science', 'level' => '400', 'lecturer' => 0],
            ['code' => 'CSC403', 'title' => 'Mobile Application Development', 'department' => 'Computer Science', 'level' => '400', 'lecturer' => 0],
            ['code' => 'CSC405', 'title' => 'Computer Networks', 'department' => 'Computer Science', 'level' => '400', 'lecturer' => 1],
            ['code' => 'CSC407', 'title' => 'Artificial Intelligence', 'department' => 'Computer Science', 'level' => '400', 'lecturer' => 1],
        ];

        $courses = collect($courseSeeds)->map(function (array $data) use ($lecturers, $admin) {
            $course = Course::query()->updateOrCreate(
                ['code' => $data['code']],
                [
                    'title' => $data['title'],
                    'department' => $data['department'],
                    'level' => $data['level'],
                    'lecturer_id' => $lecturers[$data['lecturer']]->id,
                    'created_by' => $admin->id,
                ]
            );

            CourseGeofence::query()->updateOrCreate(
                ['course_id' => $course->id],
                [
                    'shape' => 'circle',
                    'center_lat' => 7.2266000,
                    'center_lng' => 3.4400000,
                    'radius_m' => 100,
                    'polygon_json' => null,
                    'label' => 'FUNAAB Engineering Block',
                ]
            );

            return $course;
        });

        // Enroll every student in the first 3 courses.
        $coursesToEnroll = $courses->take(3);
        foreach ($students as $student) {
            foreach ($coursesToEnroll as $course) {
                CourseEnrollment::query()->updateOrCreate(
                    ['course_id' => $course->id, 'user_id' => $student->id],
                    ['enrolled_at' => now()]
                );
            }
        }

        // Demo active session for the first course.
        $firstCourse = $courses->first();
        AttendanceSession::query()->updateOrCreate(
            [
                'course_id' => $firstCourse->id,
                'status' => 'active',
            ],
            [
                'opened_by' => $firstCourse->lecturer_id ?? $admin->id,
                'mode' => 'tap',
                'starts_at' => Carbon::now()->subMinutes(5),
                'ends_at' => Carbon::now()->addMinutes(55),
                'presence_checks_enabled' => true,
                'presence_check_interval_minutes' => 15,
                'late_after_minutes' => 10,
                'notes' => 'Demo session seeded for development.',
            ]
        );
    }
}
