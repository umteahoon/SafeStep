export function homeForRole(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/admin';
    case 'ACADEMY_ADMIN':
      return '/dashboard';
    case 'TEACHER':
      return '/attendance';
    case 'PARENT':
      return '/parent/report';
    case 'STUDENT':
      return '/student/qr';
    default:
      return '/map';
  }
}
