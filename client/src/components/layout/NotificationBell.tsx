import { useEffect, useState } from 'react';
import { BellIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../lib/api';

export function NotificationBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetchCount();
    // Poll hvert 30. sekund
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, []);

  async function fetchCount() {
    try {
      const data = await apiFetch<{ count: number }>('/notifications/count');
      setCount(data.count);
    } catch {
      // ignorer feil i bakgrunnspolling
    }
  }

  return (
    <Link to="/varsler" className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-600">
      <BellIcon className="h-6 w-6" />
      {count > 0 && (
        <span className="absolute top-1 right-1 h-4 w-4 text-xs flex items-center justify-center bg-red-500 text-white rounded-full font-medium">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}
