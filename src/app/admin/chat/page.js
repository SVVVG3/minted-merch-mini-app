import { ChatAdminDashboard } from '@/components/ChatAdminDashboard';

export const metadata = {
  title: 'Chat Admin Dashboard - Minted Merch',
  description: 'Admin dashboard for monitoring $MINTEDMERCH chat eligibility',
};

export default function ChatAdminPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <ChatAdminDashboard />
    </div>
  );
}
