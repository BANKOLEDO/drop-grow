import { useState, useRef, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { ContentKind } from "@/lib/domain";
import { useSession } from "@/lib/session";
import { Icon } from "@/components/icons/icons";
import { Button } from "@/components/ui/primitives";
import { showToast } from "@/components/ui/toast";

const KIND_LABELS: Record<ContentKind, string> = {
  text: "Text",
  voice: "Voice",
  image: "Image",
};

const KIND_HINTS: Record<ContentKind, string> = {
  text: "Type your idea",
  voice: "Speak your idea",
  image: "Upload an image or photo",
};

type VoiceState = {
  recording: boolean;
  supported: boolean;
  transcript: string;
};

function useSpeech() {
  const [state, setState] = useState<VoiceState>({
    recording: false,
    supported:
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window),
    transcript: "",
  });
  const recognitionRef = useRef<any>(null);

  const startRecording = useCallback(
    (onPartial: (text: string) => void) => {
      const SR =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) return;
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";
      let final = state.transcript;
      rec.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) final += t + " ";
          else interim += t;
        }
        onPartial(final + interim);
      };
      rec.onerror = () => setState((s) => ({ ...s, recording: false }));
      rec.onend = () => setState((s) => ({ ...s, recording: false }));
      recognitionRef.current = rec;
      rec.start();
      setState((s) => ({ ...s, recording: true }));
    },
    [state.transcript]
  );

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setState((s) => ({ ...s, recording: false }));
  }, []);

  const resetTranscript = useCallback(() => {
    setState((s) => ({ ...s, transcript: "" }));
  }, []);

  return { voice: state, startRecording, stopRecording, resetTranscript };
}

function FileDrop({ onFile }: { onFile: (file: File) => void }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(list: FileList | null) {
    if (!list) return;
    for (const f of Array.from(list)) {
      onFile(f);
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={`cursor-pointer rounded-md border-2 border-dashed p-6 text-center transition-colors ${
        over ? "border-verdant-500 bg-verdant-500/5" : "border-line hover:border-ink-400"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Icon.CloudUp width={24} height={24} className="mx-auto text-ink-400 dark:text-ink-600" />
      <p className="mt-2 text-sm text-ink-600">
        Drop an image here or <span className="text-verdant-600 underline">browse</span>
      </p>
      <p className="mt-1 text-xs text-ink-400 dark:text-ink-600">
        Photos and images. Stored securely, described by AI.
      </p>
    </div>
  );
}

export function Composer() {
  const { token } = useSession();
  const createIdea = useMutation(api.ideas.createIdea);
  const generateUploadUrl = useMutation(api.ideas.generateUploadUrl);
  const saveFileToIdea = useMutation(api.ideas.saveFileToIdea);
  const saveIdeaMetadata = useMutation(api.ideas.saveIdeaMetadata);
  const [kind, setKind] = useState<ContentKind>("text");
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState<"personal" | "community">("personal");
  const [submitting, setSubmitting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const { voice, startRecording, stopRecording, resetTranscript } = useSpeech();

  async function add() {
    const content = text.trim();
    if (!content || submitting || !token) return;
    setSubmitting(true);
    try {
      const res = await createIdea({ token, input: content, contentKind: kind, visibility });
      const ideaId = res.ideaId;

      // Upload the image to Convex Blob if one was dropped
      if (pendingFile) {
        try {
          const uploadUrl = await generateUploadUrl();
          const uploadRes = await fetch(uploadUrl, {
            method: "POST",
            body: pendingFile,
            headers: { "Content-Type": pendingFile.type },
          });
          if (uploadRes.ok) {
            const { storageId } = await uploadRes.json();
            await saveFileToIdea({
              token,
              ideaId,
              storageId,
            });
            await saveIdeaMetadata({
              token,
              ideaId,
              imageDescription: `[Image: ${pendingFile.name}]`,
            });
          }
        } catch (uploadErr) {
          console.error("Image upload failed:", uploadErr);
          showToast("Image uploaded but storage failed. Idea was still created.");
        }
      }

      setText("");
      setFileName(null);
      setPendingFile(null);
      resetTranscript();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not add the idea.");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleVoice() {
    if (voice.recording) stopRecording();
    else startRecording((t) => setText(t));
  }

  function onImage(file: File) {
    if (!file.type.startsWith("image/")) return;
    setPendingFile(file);
    setFileName(file.name);
    setKind("image");
    setText(`[Image: ${file.name}]`);
  }

  return (
    <div className="border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className="mono-label">new idea</p>
          <h2 className="mt-0.5 font-display text-2xl text-ink-900">Drop an idea</h2>
        </div>
        <div className="flex items-center gap-1">
          {(["personal", "community"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVisibility(v)}
              className={`px-3 py-1.5 font-mono text-[13px] tracking-tight transition-colors ${
                visibility === v ? "bg-ink-900 text-paper" : "text-ink-600 hover:text-ink-900"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div data-tour="kinds" className="grid grid-cols-3 gap-px border-b border-line bg-line">
        {(Object.keys(KIND_LABELS) as ContentKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`flex flex-col items-center gap-1 bg-surface px-2 py-3 transition-colors ${
              kind === k ? "bg-mist text-ink-900" : "text-ink-500 hover:text-ink-700 dark:text-ink-600 dark:hover:text-ink-900"
            }`}
          >
            <Icon.Glyph kind={k} width={18} height={18} />
            <span className="font-mono text-[10px] uppercase tracking-wider">{KIND_LABELS[k]}</span>
          </button>
        ))}
      </div>

      <div className="p-5">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-400 dark:text-ink-600">
          {KIND_HINTS[kind]}
        </p>

        {kind === "voice" ? (
          <div className="space-y-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                voice.recording
                  ? "Listening... speak now"
                  : "Type or record your idea"
              }
              rows={3}
              className="w-full resize-none rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink-900 placeholder:text-ink-500 dark:placeholder:text-ink-600 focus:border-verdant-500 focus:outline-none"
            />
            <div className="flex items-center gap-3">
              {voice.supported && (
                <Button
                  variant={voice.recording ? "spore" : "outline"}
                  onClick={toggleVoice}
                >
                  {voice.recording ? "Stop recording" : "Record voice"}
                </Button>
              )}
              {voice.recording && (
                <span className="flex items-center gap-1.5 font-mono text-xs text-spore-500">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-spore-500" />
                  recording
                </span>
              )}
            </div>
          </div>
        ) : (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's the idea?"
              rows={3}
              className="w-full resize-none rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink-900 placeholder:text-ink-500 dark:placeholder:text-ink-600 focus:border-verdant-500 focus:outline-none"
            />

            {kind === "image" && (
              <div className="mt-3">
                <FileDrop onFile={onImage} />
              </div>
            )}
          </>
        )}

        {fileName && (
          <div className="mt-3 flex items-center gap-2 rounded-md bg-mist px-3 py-2">
            <Icon.Glyph kind={kind} width={14} height={14} />
            <span className="flex-1 truncate text-sm text-ink-700">{fileName}</span>
            <button
              onClick={() => {
                setFileName(null);
                setPendingFile(null);
                setText("");
              }}
              className="text-ink-400 hover:text-ink-700 dark:text-ink-600 dark:hover:text-ink-900"
            >
              ×
            </button>
          </div>
        )}

        <div className="mt-4 flex items-start justify-between gap-3">
          <p className="min-w-0 flex-1 font-mono text-[11px] leading-snug text-ink-400 dark:text-ink-600">
            {kind === "text" && "Plain text. Agents will read and respond."}
            {kind === "image" && "Image will be uploaded and described by AI."}
            {kind === "voice" && "Record or type. Transcript will be captured."}
          </p>
          <Button variant="spore" onClick={add} disabled={!text.trim() || submitting} className="shrink-0">
            {submitting ? "Adding…" : "Add idea"}
          </Button>
        </div>
      </div>
    </div>
  );
}
