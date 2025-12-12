// Ambassador dashboard has been deprecated and merged into Minted Merch Missions
// All bounties (interaction + custom) are now available at /missions
import { redirect } from 'next/navigation';

export default function AmbassadorDashboard() {
  redirect('/missions');
}

export const metadata = {
  title: 'Redirecting... | Minted Merch',
  description: 'Ambassador dashboard has moved to Minted Merch Missions',
};
