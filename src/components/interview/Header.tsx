import { Clock, MessageSquare, User, X } from "lucide-react"

interface HeaderProps {
  timeRemaining: number
  formatTime: (seconds: number) => string
  totalQuestions?: number
  currentRound?: number
  totalRounds?: number
  role?: string
  candidateName?: string
  isMobileChatOpen?: boolean
  onMobileChatToggle?: () => void
}

export function Header({
  timeRemaining,
  formatTime,
  currentRound = 1,
  totalRounds = 4,
  role = "Full Stack Developer",
  candidateName = "Sample Candidate",
  isMobileChatOpen = false,
  onMobileChatToggle,
}: HeaderProps) {
  const safeTotalRounds = Math.max(totalRounds, 1)
  const safeCurrentRound = Math.min(Math.max(currentRound, 1), safeTotalRounds)
  const completedRounds = Math.max(0, safeCurrentRound - 1)
  const isSingleRound = safeTotalRounds === 1
  const isLastMinute = timeRemaining <= 60

  const candidateInitials =
    candidateName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "SC"

  const rounds = Array.from({ length: safeTotalRounds }, (_, index) => {
    const number = index + 1

    const state =
      number < safeCurrentRound
        ? "done"
        : number === safeCurrentRound
          ? "active"
          : "upcoming"

    return { number, state }
  })

  return (
    <header className="relative z-10 w-full shrink-0 border-b border-slate-200 bg-white shadow-[0_1px_6px_rgba(15,23,42,0.04)]">
      {/* Main Navbar */}
      <div className="flex h-[58px] w-full items-center justify-between px-3 md:px-5">
        {/* Left */}
        <div className="flex h-10 items-center rounded-xl border border-sky-100 bg-sky-50/70 px-3">
          <img
            src="/logo-light.png"
            alt="CognitiveScreen AI"
            className="h-7 w-auto object-contain"
          />
        </div>

        {/* Desktop Timeline */}
        <div className="absolute left-1/2 hidden w-[300px] -translate-x-1/2 lg:block">
          <div className="relative mb-1 h-3">
            <p className="absolute top-0 left-0 text-[7px] font-semibold tracking-[0.2em] text-slate-400 uppercase">
              Progress Rounds
            </p>

            <span className="absolute top-0 right-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[8px] font-bold text-blue-600">
              {safeCurrentRound}/{safeTotalRounds}
            </span>
          </div>

          {isSingleRound ? (
            <div className="flex items-center pt-0.5">
              <div className="flex items-center gap-1.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-full border border-blue-600 bg-white text-[8px] font-semibold text-blue-600 shadow-[0_0_0_2px_rgba(37,99,235,0.12)]">
                  1
                </div>

                <span className="text-[8px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
                  Start
                </span>
              </div>

              <div className="mx-2 h-[1px] flex-1 bg-blue-100" />

              <div className="flex items-center gap-1.5">
                <span className="text-[8px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
                  Finish
                </span>

                <div className="flex h-5 w-5 items-center justify-center rounded-full border border-blue-200 bg-white text-[8px] font-semibold text-slate-400">
                  2
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center">
              {rounds.map((round, index) => (
                <div
                  key={round.number}
                  className="flex flex-1 items-center last:flex-none"
                >
                  <div
                    className={`relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[8px] font-semibold transition-all ${
                      round.state === "done"
                        ? "border-blue-600 bg-blue-600 text-white"
                        : round.state === "active"
                          ? "border-blue-600 bg-white text-blue-600 shadow-[0_0_0_2px_rgba(37,99,235,0.12)]"
                          : "border-blue-200 bg-white text-slate-400"
                    }`}
                  >
                    {round.number}
                  </div>

                  {index < rounds.length - 1 && (
                    <div className="h-[1px] flex-1 bg-blue-100">
                      <div
                        className={`h-full transition-all ${
                          index < completedRounds
                            ? "bg-blue-600"
                            : "bg-blue-100"
                        }`}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Timer + Profile */}
        <div className="flex min-w-0 items-center justify-end gap-2 md:gap-3 lg:min-w-[300px]">
          <button
            type="button"
            onClick={onMobileChatToggle}
            aria-label={isMobileChatOpen ? "Close chat" : "Open chat"}
            aria-pressed={isMobileChatOpen}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 lg:hidden"
          >
            {isMobileChatOpen ? (
              <X className="size-4" />
            ) : (
              <MessageSquare className="size-4" />
            )}
          </button>

          <div
            className={`flex h-9 items-center gap-1.5 rounded-xl border px-2.5 shadow-sm transition-all md:h-10 md:gap-2 md:px-3 ${
              isLastMinute
                ? "border-red-200 bg-red-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <Clock
              className={`size-3.5 md:size-4 ${
                isLastMinute ? "text-red-500" : "text-slate-500"
              }`}
            />

            <span
              className={`font-mono text-xs font-bold md:text-[15px] ${
                isLastMinute ? "text-red-600" : "text-slate-800"
              }`}
            >
              {formatTime(timeRemaining)}
            </span>
          </div>

          <div className="hidden h-10 items-center gap-2 rounded-xl border border-sky-100 bg-gradient-to-r from-sky-50 to-white px-3 shadow-sm lg:flex">
            <div className="flex h-6 w-6 items-center justify-center rounded-md border border-sky-200 bg-sky-100">
              <span className="text-[10px] font-bold text-sky-700">
                {role?.charAt(0)}
              </span>
            </div>

            <div className="flex min-w-0 flex-col">
              <span className="text-[7px] font-semibold tracking-[0.18em] text-slate-400 uppercase">
                Position
              </span>

              <span className="max-w-[150px] truncate text-[11px] font-semibold text-slate-700">
                {role}
              </span>
            </div>
          </div>

          <div className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 shadow-sm md:h-10 md:px-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-[11px] font-bold text-blue-600">
              {candidateInitials || <User className="size-4" />}
            </div>

            <div className="hidden leading-tight md:block">
              <p className="max-w-[120px] truncate text-xs font-bold text-slate-700">
                {candidateName}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Rounds */}
      <div className="border-t border-slate-100 bg-white px-4 pt-2 pb-3 lg:hidden">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[8px] font-semibold tracking-[0.2em] text-slate-400 uppercase">
            Progress Rounds
          </p>

          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-600">
            {safeCurrentRound}/{safeTotalRounds}
          </span>
        </div>

        {isSingleRound ? (
          <div className="flex items-center">
            <div className="flex items-center gap-1.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-blue-600 bg-white text-[9px] font-semibold text-blue-600 shadow-[0_0_0_2px_rgba(37,99,235,0.12)]">
                1
              </div>

              <span className="text-[8px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
                Start
              </span>
            </div>

            <div className="mx-2 h-[1px] flex-1 bg-blue-100" />

            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
                Finish
              </span>

              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-blue-200 bg-white text-[9px] font-semibold text-slate-400">
                2
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center">
            {rounds.map((round, index) => (
              <div
                key={round.number}
                className="flex flex-1 items-center last:flex-none"
              >
                <div
                  className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold transition-all ${
                    round.state === "done"
                      ? "border-blue-600 bg-blue-600 text-white"
                      : round.state === "active"
                        ? "border-blue-600 bg-white text-blue-600 shadow-[0_0_0_2px_rgba(37,99,235,0.12)]"
                        : "border-blue-200 bg-white text-slate-400"
                  }`}
                >
                  {round.number}
                </div>

                {index < rounds.length - 1 && (
                  <div className="h-[1px] flex-1 bg-blue-100">
                    <div
                      className={`h-full transition-all ${
                        index < completedRounds ? "bg-blue-600" : "bg-blue-100"
                      }`}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </header>
  )
}
