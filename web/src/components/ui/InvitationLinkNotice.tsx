import { useState } from 'react';
import { Button } from './Button';

export interface InvitationLinkNoticeProps {
  message: string;
  invitationUrl: string;
  onClose?: () => void;
}

export function InvitationLinkNotice({ message, invitationUrl, onClose }: InvitationLinkNoticeProps) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="rounded-xl border border-outline bg-surface-container p-4 flex flex-col gap-3 animate-in">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-[22px] text-error shrink-0">mark_email_unread</span>
        <div className="flex flex-col gap-1">
          <p className="font-body-md text-body-md text-on-surface">{message}</p>
          <span className="font-code-tracking text-code-tracking text-on-surface-variant break-all">
            {invitationUrl}
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar aviso de invitación"
            className="ml-auto p-1 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={copyLink}>
          <span className="material-symbols-outlined text-[16px]">
            {copied ? 'check' : 'content_copy'}
          </span>
          {copied ? 'Enlace copiado' : 'Copiar enlace'}
        </Button>
      </div>
    </div>
  );
}
