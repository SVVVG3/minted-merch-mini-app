'use client';

import Link from 'next/link';

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
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2.5">
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

      {footer && (
        <p className="text-xs text-gray-400 mt-3 text-center leading-snug">{footer}</p>
      )}
    </div>
  );
}

function formatPayoutPerUnit(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return '5M $MM';
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M $MM`;
  return `${n.toLocaleString()} $MM`;
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
  const voteWeight = viewer.voteWeight || 1;
  const voteNote = voteWeight > 1
    ? `Your vote counts as ${voteWeight} points (staked $MM holder)`
    : 'Everyone gets 1 vote — stake more $MM for up to 10× voting power';

  if (phase === 'active' || phase === 'submissions' || phase === 'voting') {
    const whatToDo = [];
    if (viewer.userSubmission) {
      whatToDo.push('Your design is in — share it and rally votes from the community');
    } else {
      whatToDo.push('Create one custom design in Design Studio and submit it to enter');
    }
    if (viewer.hasVoted) {
      whatToDo.push('Your vote is locked in — watch the leaderboard until voting ends');
    } else if (viewer.fid) {
      whatToDo.push('Vote for your favorite entry below (you cannot vote for your own design)');
    } else {
      whatToDo.push('Sign in with Farcaster to submit a design and cast your vote');
    }
    whatToDo.push(voteNote);
    if (countdownText) {
      whatToDo.push(`Submit & vote window closes in ${countdownText}`);
    }

    return {
      icon: '🎯',
      title: 'How Limited Drops Work',
      description:
        'A weekly community design contest. The top-voted design becomes a real limited-edition product in the Minted Merch shop.',
      sections: [
        { label: 'What to do now', items: whatToDo },
        {
          label: 'If your design wins',
          items: [
            'Your design goes live here for a 48-hour sale window',
            `Only ${maxUnits} units are produced — first come, first served`,
            `Earn ${payout} per unit sold — claim anytime in Profile → Drop Earnings`,
          ],
        },
        {
          label: 'What happens next',
          items: [
            'When the timer ends, the design with the most votes wins',
            'The winning design opens for purchase in Limited Drops',
            'The sale ends after 48 hours or when all units sell out',
          ],
        },
      ],
      primaryAction: !viewer.userSubmission && viewer.fid
        ? { label: '🎨 Create & Submit a Design', href: '/create' }
        : null,
      footer: !viewer.userSubmission && viewer.fid
        ? 'One submission per person per drop'
        : viewer.userSubmission && !viewer.hasVoted && viewer.fid
          ? 'Scroll down to vote for your favorite design'
          : null,
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
      'Checkout like any other Minted Merch order',
      `${unitsLeft} of ${maxUnits} units remaining`,
    ];
    if (countdownText) {
      buyItems.push(`Sale ends in ${countdownText} — don't wait too long`);
    }

    return {
      icon: '⚡',
      title: 'Limited Drop — Live Now',
      description:
        'This is a community-voted design with a strict cap on quantity and time. Once it\'s gone, it\'s gone.',
      sections: [
        { label: 'How to buy', items: buyItems },
        {
          label: 'About this drop',
          items: [
            `Only ${maxUnits} units will ever be made for this design`,
            '48-hour sale window — ends early if sold out',
            'Want your own design instead? Use Design Studio below',
          ],
        },
      ],
    };
  }

  if (phase === 'sold_out') {
    return {
      icon: '🔥',
      title: 'Drop Complete',
      description:
        `All ${maxUnits} units from this limited drop have sold out. Thanks to everyone who participated!`,
      sections: [
        {
          label: 'What happens next',
          items: [
            'The winning designer can claim earnings in Profile → Drop Earnings',
            'Watch Limited Drops for the next weekly contest',
            'Create your own custom merch anytime in Design Studio',
          ],
        },
      ],
      primaryAction: { label: '🎨 Open Design Studio', href: '/create' },
    };
  }

  if (phase === 'none') {
    return {
      sections: [
        {
          label: 'How limited drops work',
          items: [
            'Designers submit one custom design per weekly drop',
            'The community votes — most votes wins',
            `${maxUnits} units go on sale for 48 hours when a winner is chosen`,
          ],
        },
        {
          label: 'If your design wins',
          items: [
            `Your design is produced as a limited run of ${maxUnits} units`,
            `Earn ${payout} per unit sold`,
            'Claim earnings in Profile → Drop Earnings after the sale ends',
          ],
        },
        {
          label: 'While you wait',
          items: [
            'Create and order your own custom merch in Design Studio anytime',
            'Turn on mini app notifications so you know when the next drop opens',
            'Stake $MM for up to 10× voting power when submit & vote returns',
          ],
        },
      ],
      primaryAction: { label: '🎨 Enter Design Studio', href: '/create' },
      footer: 'Check back here — the next drop will appear on this page when it opens',
    };
  }

  return {
    sections: [],
    primaryAction: { label: '🎨 Enter Design Studio', href: '/create' },
  };
}
