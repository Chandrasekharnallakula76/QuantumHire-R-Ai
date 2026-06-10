import { Bot, LoaderCircle, Sparkles } from "lucide-react"
import type { Message, Question } from "./types"

interface ChatRoomProps {
  chatMessages: Message[]
  isAiTyping: boolean
  chatEndRef: React.RefObject<HTMLDivElement | null>
  currentQuestion: Question | null
  currentQuestionIndex: number
  totalQuestions: number
  isCurrentAnswered: boolean
  isSubmittingAnswer: boolean
  onAnswerSelect: (optionIndex: number) => void
  onFreeTextSubmit: (text: string) => void
  answeredCount: number
  currentRound: number
  totalRounds: number
  currentRoundName: string
  isMobileDrawerOpen?: boolean
  onCloseMobileDrawer?: () => void
}

export function ChatRoom({
  chatMessages,
  isAiTyping,
  chatEndRef,
  currentQuestion,
  currentQuestionIndex,
  isCurrentAnswered: _isCurrentAnswered,
  onAnswerSelect: _onAnswerSelect,
  answeredCount: _answeredCount,
  currentRound: _currentRound,
  totalRounds: _totalRounds,
  currentRoundName: _currentRoundName,
  isMobileDrawerOpen = false,
  onCloseMobileDrawer,
}: ChatRoomProps) {
  return (
    <aside
      className={`fixed top-0 left-0 z-40 flex h-full w-[min(85vw,340px)] flex-col overflow-hidden border-r border-slate-200 bg-white shadow-none transition-transform duration-300 lg:static lg:z-auto lg:h-auto lg:w-80 lg:translate-x-0 lg:border-r-0 lg:border-l ${
        isMobileDrawerOpen ? "translate-x-0" : "-translate-x-full"
      }`}
      aria-hidden={!isMobileDrawerOpen}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 lg:hidden">
        <div>
          <p className="text-xs font-semibold text-slate-800">Interview Chat</p>
          <p className="text-[10px] text-slate-500">Messages and prompts</p>
        </div>

        <button
          type="button"
          onClick={onCloseMobileDrawer}
          aria-label="Close chat"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
        >
          <span className="text-base leading-none">×</span>
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {chatMessages.map((msg) => {
          const isRecruiter = msg.sender === "recruiter"

          return (
            <div
              key={msg.id}
              className={`flex gap-2 ${
                isRecruiter
                  ? "max-w-[92%] self-start"
                  : "max-w-[92%] flex-row-reverse self-end"
              }`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                  isRecruiter
                    ? "border-indigo-100 bg-indigo-50 text-indigo-600"
                    : "border-sky-100 bg-sky-50 text-sky-700"
                }`}
              >
                {isRecruiter ? <Bot className="size-3.5" /> : "C"}
              </div>

              <div className="flex flex-col gap-0.5">
                <div
                  className={`flex items-center gap-1.5 text-[9px] font-medium ${
                    isRecruiter
                      ? "text-slate-400"
                      : "justify-end text-slate-300"
                  }`}
                >
                  <span>{isRecruiter ? "Elena AI" : "You"}</span>
                  <span>&bull;</span>
                  <span>{msg.time}</span>
                </div>

                <div
                  className={`rounded-2xl p-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                    isRecruiter
                      ? "rounded-tl-none border border-slate-200 bg-slate-100 text-slate-800"
                      : "rounded-tr-none border border-sky-100 bg-sky-50 text-slate-700"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          )
        })}

        {isAiTyping && (
          <div className="flex gap-2 self-start">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50 text-indigo-600 shadow-sm">
              <Sparkles className="size-3.5" />
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-medium text-slate-500">
                Elena AI is generating
              </span>

              <div className="flex min-h-10 items-center gap-2 rounded-2xl rounded-tl-none border border-indigo-100 bg-gradient-to-r from-indigo-50 to-slate-100 px-3 py-2 text-xs text-slate-700 shadow-sm">
                <LoaderCircle className="size-4 animate-spin text-indigo-500" />
                <span>Generating next response...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {!currentQuestion &&
        currentQuestionIndex === -1 &&
        chatMessages.length === 0 && (
          <div className="border-t border-slate-200 p-4 text-center">
            <p className="text-xs text-slate-600">
              Waiting for interview to start...
            </p>
          </div>
        )}
    </aside>
  )
}

export default ChatRoom
