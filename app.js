
(() => {
  const $ = id => document.getElementById(id);
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  const startBtn = $("startBtn");
  const pauseBtn = $("pauseBtn");
  const statusText = $("statusText");
  const statusDot = $("statusDot");
  const supportNote = $("supportNote");
  const liveJapanese = $("liveJapanese");
  const liveKorean = $("liveKorean");
  const historyEl = $("history");
  const countLabel = $("countLabel");

  let recognition = null;
  let running = false;
  let manuallyStopped = true;
  let sessionId = 0;
  let restartTimer = null;
  let translationTimer = null;
  let requestId = 0;
  let interimText = "";
  let lastCommitted = "";
  let history = [];

  try {
    history = JSON.parse(localStorage.getItem("nihongo-live-history") || "[]");
  } catch {}

  renderHistory();

  function setStatus(text, active = false) {
    statusText.textContent = text;
    statusDot.classList.toggle("active", active);
  }

  function renderHistory() {
    historyEl.innerHTML = "";

    history.forEach(item => {
      const card = document.createElement("article");
      card.className = "history-item";

      const ja = document.createElement("p");
      ja.className = "ja";
      ja.textContent = item.ja;

      const ko = document.createElement("p");
      ko.className = "ko";
      ko.textContent = item.ko;

      const time = document.createElement("time");
      time.textContent = item.time;

      card.append(ja, ko, time);
      historyEl.append(card);
    });

    countLabel.textContent = `${history.length}개 문장`;
  }

  function persist() {
    try {
      localStorage.setItem(
        "nihongo-live-history",
        JSON.stringify(history.slice(-150))
      );
    } catch {}
  }

  function speakKorean(text) {
    if (
      !$("speakToggle").checked ||
      !("speechSynthesis" in window) ||
      !text
    ) return;

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 1;

    speechSynthesis.speak(utterance);
  }

  async function translate(text, isFinal = false) {
    const clean = text.trim();
    if (!clean) return;

    const id = ++requestId;

    liveJapanese.textContent = clean;
    liveKorean.textContent = "번역 중…";

    try {
      const url =
        "https://api.mymemory.translated.net/get?q=" +
        encodeURIComponent(clean.slice(0, 450)) +
        "&langpair=ja|ko";

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("번역 서버 응답 오류");
      }

      const data = await response.json();
      const translated = data?.responseData?.translatedText;

      if (!translated) {
        throw new Error("번역 결과가 없습니다.");
      }

      if (id !== requestId) return;

      const decoded = document.createElement("textarea");
      decoded.innerHTML = translated;

      const ko = decoded.value;
      liveKorean.textContent = ko;

      if (isFinal && clean !== lastCommitted) {
        lastCommitted = clean;

        history.push({
          ja: clean,
          ko,
          time: new Date().toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit"
          })
        });

        history = history.slice(-150);
        persist();
        renderHistory();

        if ($("autoScrollToggle").checked) {
          historyEl.lastElementChild?.scrollIntoView({
            behavior: "smooth",
            block: "end"
          });
        }

        speakKorean(ko);
      }
    } catch (err) {
      if (id === requestId) {
        liveKorean.textContent = "번역 오류: " + err.message;
      }
    }
  }

  function updateButtons() {
    startBtn.disabled = running;
    pauseBtn.disabled = !running;
  }

  function startRecognition(mySession) {
    if (!running || manuallyStopped || mySession !== sessionId) return;

    const rec = new SpeechRecognition();
    recognition = rec;

    rec.lang = "ja-JP";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      if (rec !== recognition || mySession !== sessionId) return;

      setStatus("일본어 음성 듣는 중", true);
      supportNote.textContent =
        "일본어로 말하면 자동으로 인식하고 번역합니다.";
    };

    rec.onresult = event => {
      if (
        rec !== recognition ||
        mySession !== sessionId ||
        !running
      ) return;

      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          const clean = transcript.trim();

          if (clean) {
            clearTimeout(translationTimer);
            translate(clean, true);
          }
        } else {
          interim += transcript;
        }
      }

      interimText = interim;

      if (interimText.trim()) {
        liveJapanese.textContent = interimText.trim();

        clearTimeout(translationTimer);

        translationTimer = setTimeout(() => {
          if (
            running &&
            mySession === sessionId &&
            interimText.trim()
          ) {
            translate(interimText, false);
          }
        }, 650);
      }
    };

    rec.onerror = event => {
      if (rec !== recognition || mySession !== sessionId) return;

      const messages = {
        "not-allowed":
          "마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크를 허용해 주세요.",
        "service-not-allowed":
          "브라우저 음성 인식 서비스가 차단되었습니다.",
        "no-speech":
          "음성이 감지되지 않았습니다. 다시 듣기를 시도합니다.",
        "network":
          "음성 인식 네트워크 오류입니다."
      };

      supportNote.textContent =
        messages[event.error] || `음성 인식 오류: ${event.error}`;

      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        running = false;
        manuallyStopped = true;
        sessionId++;

        clearTimeout(restartTimer);
        recognition = null;

        setStatus("마이크 권한 확인 필요");
        updateButtons();
      }
    };

    rec.onend = () => {
      if (rec !== recognition || mySession !== sessionId) return;

      recognition = null;

      if (running && !manuallyStopped) {
        clearTimeout(restartTimer);

        restartTimer = setTimeout(() => {
          if (running && !manuallyStopped && mySession === sessionId) {
            startRecognition(mySession);
          }
        }, 500);
      } else {
        setStatus("일시정지");
        updateButtons();
      }
    };

    try {
      rec.start();
    } catch (err) {
      if (rec === recognition) recognition = null;

      running = false;
      manuallyStopped = true;

      setStatus("시작할 수 없음");
      supportNote.textContent =
        "음성 인식을 시작할 수 없습니다. 잠시 기다린 뒤 다시 눌러 주세요.";

      updateButtons();
    }
  }

  startBtn.addEventListener("click", () => {
    if (!SpeechRecognition) {
      supportNote.textContent =
        "이 브라우저는 음성 인식을 지원하지 않습니다.";
      return;
    }

    if (running) return;

    clearTimeout(restartTimer);
    clearTimeout(translationTimer);

    interimText = "";
    manuallyStopped = false;
    running = true;
    sessionId++;

    updateButtons();
    setStatus("마이크 연결 중", true);

    startRecognition(sessionId);
  });

  pauseBtn.addEventListener("click", () => {
    running = false;
    manuallyStopped = true;
    sessionId++;

    clearTimeout(restartTimer);
    clearTimeout(translationTimer);

    interimText = "";

    const oldRecognition = recognition;
    recognition = null;

    if (oldRecognition) {
      oldRecognition.onend = null;
      oldRecognition.onerror = null;

      try {
        oldRecognition.stop();
      } catch {}
    }

    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
    }

    setStatus("일시정지");
    supportNote.textContent =
      "다시 번역하려면 번역 시작을 눌러 주세요.";

    updateButtons();
  });

  $("clearBtn").addEventListener("click", () => {
    if (!confirm("번역 기록을 모두 지울까요?")) return;

    history = [];
    lastCommitted = "";
    interimText = "";

    requestId++;
    clearTimeout(translationTimer);

    persist();
    renderHistory();

    liveJapanese.textContent =
      "일본어 음성이 여기에 표시됩니다.";

    liveKorean.textContent =
      "번역 결과가 여기에 표시됩니다.";

    if (running) {
      supportNote.textContent =
        "기록을 지웠습니다. 계속 일본어를 말해 주세요.";
    }
  });

  let deferredPrompt;

  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredPrompt = e;
    $("installBtn").hidden = false;
  });

  $("installBtn").addEventListener("click", async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;

    deferredPrompt = null;
    $("installBtn").hidden = true;
  });

  if (!window.isSecureContext && location.hostname !== "localhost") {
    supportNote.textContent =
      "마이크 사용을 위해 HTTPS 주소로 접속해야 합니다.";
  }

  if (!SpeechRecognition) {
    $("engineLabel").textContent = "지원 브라우저 확인 필요";
    supportNote.textContent =
      "이 브라우저에서 음성 인식 기능을 사용할 수 없습니다.";
    startBtn.disabled = true;
  } else {
    $("engineLabel").textContent = "브라우저 음성 인식";
  }

  if (
    "serviceWorker" in navigator &&
    (location.protocol === "https:" || location.hostname === "localhost")
  ) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
})();
