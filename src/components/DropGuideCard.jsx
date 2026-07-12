'use client';

import Link from 'next/link';
import { DesignStudioBanner } from './DesignStudioBanner';

function CheckItem({ children }) {
  return (
    <li className="flex gap-2.5 text-sm text-gray-600 leading-snug">
      <span className="text-[#3eb489] font-bold flex-shrink-0 mt-0.5">✓</span>
      <span>{children}</span>
    </li>
  );
}

function GuideSection({ label, items, isFirst }) {
  if (!items?.length) return null;
  return (
    <div className={isFirst ? '' : 'mt-4'}>
      <p className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-2.5">
        {label}
      </p>
      <ul className="space-y-2">
        {items.map((item) => (
          <CheckItem key={item}>{item}</CheckItem>
        ))}
      </ul>
    </div>
  );
}

export function DropGuideCard({
  icon,
  title,
  description,
  sections = [],
  primaryAction,
  designStudioBanner = false,
  footer,
  className = '',
}) {
  const showHeader = !!(title || description);

  return (
    <div className={`rounded-2xl bg-white border border-gray-100 shadow-sm p-5 ${className}`}>
      {showHeader && (
        <div className="flex items-start gap-3">
          {icon && (
            <div className="w-10 h-10 rounded-xl bg-[#3eb489]/10 flex items-center justify-center text-xl flex-shrink-0">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {title && (
              <h3 className="font-bold text-base text-gray-900">{title}</h3>
            )}
            {description && (
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{description}</p>
            )}
          </div>
        </div>
      )}

      {sections.map((section, index) => (
        <GuideSection
          key={section.label}
          label={section.label}
          items={section.items}
          isFirst={index === 0 && !showHeader}
        />
      ))}

      {primaryAction && (
        <div className="mt-5">
          {primaryAction.href ? (
            <Link
              href={primaryAction.href}
              className="block w-full py-3.5 bg-[#3eb489] hover:bg-[#359970] text-white font-semibold rounded-2xl text-sm text-center transition-colors"
            >
              {primaryAction.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              className="w-full py-3.5 bg-[#3eb489] hover:bg-[#359970] disabled:opacity-50 text-white font-semibold rounded-2xl text-sm transition-colors"
            >
              {primaryAction.label}
            </button>
          )}
        </div>
      )}

      {designStudioBanner && (
        <DesignStudioBanner compact fullWidth className="mt-5" />
      )}

      {footer && (
        <p className="text-xs text-gray-400 mt-3 text-center leading-snug">{footer}</p>
      )}
    </div>
  );
}

function formatPayoutPerUnit(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return '5M $mintedmerch';
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M $mintedmerch`;
  return `${n.toLocaleString()} $mintedmerch`;
}

function getVoteNote(viewer = {}) {
  const voteWeight = viewer.voteWeight || 1;
  const tier = viewer.voteTier || 'standard';
  if (tier === 'whale') {
    return `Your vote counts as ${voteWeight} points (staking 200M+ $mintedmerch)`;
  }
  if (tier === 'mogul') {
    return `Your vote counts as ${voteWeight} points (staking 50M+ $mintedmerch)`;
  }
  return 'Everyone gets 1 vote — stake 50M+ $mintedmerch for boosted voting power';
}

export function buildDropGuideContent({
  phase,
  drop,
  viewer = {},
  countdown,
  unitsLeft,
  canOrder,
}) {
  const maxUnits = drop?.maxUnits || 37;
  const payout = formatPayoutPerUnit(drop?.creatorPayoutPerUnit);
  const countdownText = countdown && countdown !== 'Ended' ? countdown.replace(' left', '') : null;
  const voteNote = getVoteNote(viewer);

  if (phase === 'active' || phase === 'submissions' || phase === 'voting') {
    const whatToDo = viewer.fid
      ? [
          'Select a saved design from your library or create a new one to submit and enter',
          viewer.hasVoted
            ? 'Your vote is locked in — watch the leaderboard until voting ends'
            : 'Vote for your favorite entry below (you cannot vote for your own design)',
          voteNote,
          ...(countdownText ? [`Submit & vote window closes in ${countdownText}`] : []),
        ]
      : [
          'Sign in with Farcaster to submit a design and cast your vote',
          voteNote,
          ...(countdownText ? [`Submit & vote window closes in ${countdownText}`] : []),
        ];

    return {
      sections: [
        { label: 'What to do now', items: whatToDo },
        {
          label: 'What happens next',
          items: [
            'When the timer ends, the design with the most votes wins',
            'The winning design opens for purchase in Limited Drops immediately',
            `The sale ends after 48 hours or when all ${maxUnits} units sell out — whichever comes first`,
          ],
        },
        {
          label: 'If your design wins',
          items: [
            'Your design goes live here immediately for a 48-hour sale window',
            `Only ${maxUnits} units will be produced — first come, first served`,
            'Earn 5M $mintedmerch per unit sold — claim after the drop completes in Profile → Drop Earnings',
          ],
        },
      ],
    };
  }

  if (phase === 'winner_pending') {
    return {
      icon: '🏆',
      title: 'Winner Selected',
      description:
        'Voting is over and the community has picked this week\'s winning design. The limited drop sale opens here soon.',
      sections: [
        {
          label: 'What happens next',
          items: [
            'The winning design is being prepared for the shop',
            `Sale opens in Limited Drops — only ${maxUnits} units available`,
            'You\'ll have 48 hours to order once the drop goes live',
          ],
        },
        {
          label: 'For the winning designer',
          items: [
            `Earn ${payout} for every unit sold during the drop`,
            'Payouts appear in Profile → Drop Earnings after the sale ends',
            'Share the drop when it goes live to maximize your earnings',
          ],
        },
      ],
    };
  }

  if (phase === 'live') {
    const buyItems = [
      'Tap Order Now, pick your size, and add to cart',
      'Tap the cart icon & checkout — best discount is applied in cart',
      `${unitsLeft} of ${maxUnits} units remaining`,
    ];
    if (countdownText) {
      buyItems.push(`Sale ends in ${countdownText} — don't wait too long!`);
    }

    return {
      sections: [
        { label: 'How to buy', items: buyItems },
        {
          label: 'About this drop',
          items: [
            `Only up to ${maxUnits} units will ever be made for this design`,
            '48-hour sale window — ends early if sold out',
            'Creator earns $mintedmerch for every unit sold',
            'Want to order your own design or create one for the next drop? Use the Minted Merch Design Studio below',
          ],
        },
      ],
    };
  }

  if (phase === 'sold_out') {
    return {
      sections: [
        {
          label: 'What happens next',
          items: [
            'The winning designer can claim earnings in Profile → Drop Earnings',
            'Turn on notifications & watch Limited Drops for a chance to submit a design for the next drop',
            'Create & order your own custom merch anytime in the Minted Merch Design Studio',
          ],
        },
      ],
    };
  }

  if (phase === 'none') {
    return {
      sections: [
        {
          label: 'How limited drops work',
          items: [
            'Designers submit one custom design per drop',
            'The community votes — most votes wins',
            `Up to ${maxUnits} units go on sale for 48 hours when a winner is chosen`,
          ],
        },
        {
          label: 'If your design wins',
          items: [
            `Your design goes live for purchase for 48 hours or ${maxUnits} units — whichever comes first`,
            'Earn 5M $mintedmerch per unit sold',
            'Claim all earnings in Profile → Drop Earnings after the sale ends',
          ],
        },
        {
          label: 'While you wait',
          items: [
            'Create and order your own custom merch in the Minted Merch Design Studio anytime',
            'Turn on mini app notifications so you know when the next drop opens',
            'Stake 50M+ $mintedmerch for 15% off every order & up to 10× voting power on every drop',
          ],
        },
      ],
      designStudioBanner: true,
      footer: 'Check back here — the next drop will appear on this page when it opens',
    };
  }

  return {
    sections: [],
    designStudioBanner: true,
  };
}
