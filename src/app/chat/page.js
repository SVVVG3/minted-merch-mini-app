import { ChatEligibilityChecker } from '@/components/ChatEligibilityChecker';

export const metadata = {
  title: '$MINTEDMERCH Holders Chat - Minted Merch',
  description: 'Check your eligibility for the exclusive $MINTEDMERCH token holders chat',
  other: {
    'fc:frame': JSON.stringify({
      version: "next",
      imageUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/og/chat-eligibility`,
      button: {
        title: "Check Chat Eligibility",
        action: {
          type: "launch_frame",
          name: "mintedmerch-chat",
          url: `${process.env.NEXT_PUBLIC_BASE_URL}/chat`,
          splashImageUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/logo.png`,
          splashBackgroundColor: "#3eb489"
        }
      }
    })
  }
};

export default function ChatPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            $MINTEDMERCH Holders Chat
          </h1>
          <p className="text-lg text-gray-600">
            Exclusive community for holders of 50M+ $MINTEDMERCH tokens
          </p>
        </div>

        <ChatEligibilityChecker />

        <div className="mt-8 bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            About the Holders Chat
          </h2>
          <div className="space-y-3 text-gray-600">
            <p>
              🎫 <strong>Requirement:</strong> Hold 50,000,000+ $MINTEDMERCH tokens across all your connected wallets
            </p>
            <p>
              🔄 <strong>Monitoring:</strong> Token balances are checked regularly - members who fall below the requirement may be removed
            </p>
            <p>
              💬 <strong>Access:</strong> Generate an invitation token above and contact an admin to be added
            </p>
            <p>
              🔗 <strong>Wallets:</strong> All wallets connected to your Farcaster profile are checked automatically
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <a 
            href="/"
            className="text-[#3eb489] hover:text-green-600 font-medium"
          >
            ← Back to Minted Merch
          </a>
        </div>
      </div>
    </div>
  );
}
