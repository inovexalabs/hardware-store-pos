'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { shrinkImage } from '@/utils/image';
import { MAX_RECEIPT_BYTES, RECEIPT_TYPES, isPdfReceipt } from '@/lib/receipts';
import { Camera, ExternalLink, FileText, ImagePlus, Loader2, Trash2 } from 'lucide-react';

/** What the expense form should do with the receipt when it saves. */
export type ReceiptValue =
  | { kind: 'none' }
  | { kind: 'existing'; path: string }
  | { kind: 'new'; file: File };

interface Props {
  value: ReceiptValue;
  onChange: (value: ReceiptValue) => void;
  /** set when editing, so the saved receipt can be opened */
  expenseId?: string;
  disabled?: boolean;
}

/**
 * Attach a photo or PDF of the bill. On phones "Take Photo" opens the
 * camera directly; photos are shrunk before upload.
 */
export function ReceiptPicker({ value, onChange, expenseId, disabled }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  // local preview for a newly chosen photo; freed when it changes
  const newFile = value.kind === 'new' ? value.file : null;
  useEffect(() => {
    if (!newFile || newFile.type === 'application/pdf') return;
    const url = URL.createObjectURL(newFile);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with a browser object URL
    setPreview(url);
    return () => {
      URL.revokeObjectURL(url);
      setPreview(null);
    };
  }, [newFile]);

  async function handlePicked(file: File | undefined) {
    if (!file) return;
    setPreparing(true);
    try {
      const ready = await shrinkImage(file);
      if (!RECEIPT_TYPES[ready.type]) {
        toast.error('Only photos (JPG, PNG, WEBP) or PDF files can be attached as a receipt.');
        return;
      }
      if (ready.size > MAX_RECEIPT_BYTES) {
        toast.error('The file is too large. Choose one smaller than 4 MB.');
        return;
      }
      onChange({ kind: 'new', file: ready });
    } finally {
      setPreparing(false);
      if (cameraRef.current) cameraRef.current.value = '';
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const viewHref = expenseId ? `/expenses/${expenseId}/receipt` : null;

  return (
    <div className="space-y-2">
      <Label>Receipt photo (optional)</Label>

      {value.kind === 'none' ? (
        <div className="rounded-lg border border-dashed p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Keep a copy of the bill: take a photo, or attach a photo or PDF you already have.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => cameraRef.current?.click()}
              disabled={disabled || preparing}
            >
              {preparing ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <Camera data-icon="inline-start" />
              )}
              Take Photo
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={disabled || preparing}
            >
              <ImagePlus data-icon="inline-start" />
              Choose File
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
          {value.kind === 'new' && preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview
            <img src={preview} alt="Receipt preview" className="h-20 w-20 rounded-md border object-cover" />
          ) : value.kind === 'existing' && !isPdfReceipt(value.path) && viewHref ? (
            // eslint-disable-next-line @next/next/no-img-element -- private signed image
            <img src={viewHref} alt="Saved receipt" className="h-20 w-20 rounded-md border object-cover" />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-md border bg-muted">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </span>
          )}

          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">
              {value.kind === 'new' ? 'New receipt ready' : 'Receipt attached'}
            </p>
            <p className="text-muted-foreground">
              {value.kind === 'new'
                ? `${value.file.name} · ${Math.max(1, Math.round(value.file.size / 1024))} KB · uploads when you save`
                : isPdfReceipt(value.path)
                  ? 'PDF file'
                  : 'Photo'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {value.kind === 'existing' && viewHref && (
              <Button type="button" variant="outline" size="sm" asChild>
                <a href={viewHref} target="_blank" rel="noreferrer">
                  <ExternalLink data-icon="inline-start" />
                  Open
                </a>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={disabled || preparing}
            >
              {preparing ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <ImagePlus data-icon="inline-start" />}
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange({ kind: 'none' })}
              disabled={disabled}
            >
              <Trash2 className="text-destructive" data-icon="inline-start" />
              Remove
            </Button>
          </div>
        </div>
      )}

      {/* camera on phones; normal file picker on computers */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handlePicked(e.target.files?.[0])}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
        className="hidden"
        onChange={(e) => handlePicked(e.target.files?.[0])}
      />
    </div>
  );
}
