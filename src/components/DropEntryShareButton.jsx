'use client';

import { ShareDropdown } from './ShareDropdown';

function getDropEntryShareContent(entry, shareType) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const mockupId = entry?.mockupId || entry?.mockup_id;
  const url = mockupId
    ? `${origin}/design/${mockupId}?dropShare=1`
    : `${origin}/?collection=limited-drops`;

  if (shareType === 'submission') {
    return {
      customUrl: url,
      customText:
        'I just submitted my design for the upcoming @mintedmerch Limited Drop!\n\nSubmit your own & cast your vote below ↓',
    };
  }

  const creator = entry?.username ? `@${entry.username}` : '@mintedmerch';
  return {
    customUrl: url,
    customText: `I voted for ${creator}'s design to be the next @mintedmerch Limited Drop!\n\nVote & submit your design in the mini app ↓`,
  };
}

export function DropEntryShareButton({ entry, shareType, isInFarcaster, className = '' }) {
  const content = getDropEntryShareContent(entry, shareType);
  return (
    <div className={`w-full [&>div]:w-full [&_button]:w-full [&_button]:justify-center ${className}`}>
      <ShareDropdown
        type="custom"
        customUrl={content.customUrl}
        customText={content.customText}
        isInFarcaster={isInFarcaster}
        buttonStyle="text"
        buttonText={shareType === 'submission' ? 'Share My Entry' : 'Share My Vote'}
        dropUp
      />
    </div>
  );
}
