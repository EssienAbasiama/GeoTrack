<?php

namespace Database\Seeders;

use App\Models\Course;
use App\Models\CourseEnrollment;
use App\Models\CourseGeofence;
use App\Models\Institution;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

/**
 * Adds Electrical & Electronics Engineering (EEE) classes to the existing
 * database. Idempotent (updateOrCreate keyed on natural keys), so it can be run
 * repeatedly without creating duplicates. It reuses the seeded FUNAAB
 * institution and superadmin, and creates its own EEE lecturer + students.
 */
class ElectricalEngineeringSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        // Reuse the existing superadmin and institution (created by DatabaseSeeder).
        // firstOrCreate keeps this seeder runnable on its own too.
        $admin = User::query()->firstOrCreate(
            ['email' => 'admin@geotrack.edu'],
            [
                'name' => 'GeoTrack Admin',
                'password' => 'Password123!',
                'role' => 'superadmin',
                'email_verified_at' => now(),
            ]
        );

        $institution = Institution::query()->firstOrCreate(
            ['code' => 'FUNAAB'],
            [
                'name'       => 'Federal University of Agriculture, Abeokuta',
                'address'    => 'Alabata Road, Abeokuta, Ogun State, Nigeria',
                'created_by' => $admin->id,
            ]
        );

        // EEE lecturers.
        $lecturers = collect([
            ['name' => 'Dr. Emeka Okafor', 'email' => 'emeka.okafor@geotrack.edu'],
            ['name' => 'Dr. Yusuf Ibrahim', 'email' => 'yusuf.ibrahim@geotrack.edu'],
        ])->map(function (array $data) use ($institution) {
            return User::query()->updateOrCreate(
                ['email' => $data['email']],
                [
                    'name'              => $data['name'],
                    'password'          => 'Password123!',
                    'role'              => 'lecturer',
                    'email_verified_at' => now(),
                    'institution_id'    => $institution->id,
                ]
            );
        });

        // EEE students.
        $studentSeeds = [
            ['name' => 'Musa Danladi', 'matric_no' => 'FUNAAB/EEE/2022/001'],
            ['name' => 'Grace Effiong', 'matric_no' => 'FUNAAB/EEE/2022/002'],
            ['name' => 'Segun Balogun', 'matric_no' => 'FUNAAB/EEE/2022/003'],
            ['name' => 'Halima Sani', 'matric_no' => 'FUNAAB/EEE/2022/004'],
            ['name' => 'Peter Okon', 'matric_no' => 'FUNAAB/EEE/2022/005'],
        ];
        $students = collect($studentSeeds)->map(function (array $data) use ($institution) {
            $slug = strtolower(str_replace(' ', '.', $data['name']));
            return User::query()->updateOrCreate(
                ['matric_no' => $data['matric_no']],
                [
                    'name'              => $data['name'],
                    'email'             => $slug . '@students.geotrack.edu',
                    'password'          => 'Password123!',
                    'role'              => 'student',
                    'email_verified_at' => now(),
                    'institution_id'    => $institution->id,
                ]
            );
        });

        // EEE courses (classes). `lecturer` indexes into $lecturers above.
        $courseSeeds = [
            ['code' => 'EEE301', 'title' => 'Circuit Theory I',                 'level' => '300', 'lecturer' => 0],
            ['code' => 'EEE311', 'title' => 'Electromagnetic Fields and Waves', 'level' => '300', 'lecturer' => 0],
            ['code' => 'EEE401', 'title' => 'Control Systems Engineering',       'level' => '400', 'lecturer' => 0],
            ['code' => 'EEE403', 'title' => 'Power Systems Analysis',            'level' => '400', 'lecturer' => 1],
            ['code' => 'EEE405', 'title' => 'Digital Signal Processing',         'level' => '400', 'lecturer' => 1],
            ['code' => 'EEE501', 'title' => 'Power Electronics',                 'level' => '500', 'lecturer' => 1],
        ];

        $courses = collect($courseSeeds)->map(function (array $data) use ($lecturers, $admin, $institution) {
            $course = Course::query()->updateOrCreate(
                ['code' => $data['code']],
                [
                    'title'          => $data['title'],
                    'department'     => 'Electrical and Electronics Engineering',
                    'level'          => $data['level'],
                    'lecturer_id'    => $lecturers[$data['lecturer']]->id,
                    'created_by'     => $admin->id,
                    'institution_id' => $institution->id,
                ]
            );

            CourseGeofence::query()->updateOrCreate(
                ['course_id' => $course->id],
                [
                    'shape'        => 'circle',
                    'center_lat'   => 7.2270000,
                    'center_lng'   => 3.4410000,
                    'radius_m'     => 100,
                    'polygon_json' => null,
                    'label'        => 'FUNAAB Electrical Engineering Building',
                ]
            );

            return $course;
        });

        // Enroll every EEE student in the 300- and 400-level courses (first 5).
        $coursesToEnroll = $courses->take(5);
        foreach ($students as $student) {
            foreach ($coursesToEnroll as $course) {
                CourseEnrollment::query()->updateOrCreate(
                    ['course_id' => $course->id, 'user_id' => $student->id],
                    ['enrolled_at' => now()]
                );
            }
        }
    }
}
