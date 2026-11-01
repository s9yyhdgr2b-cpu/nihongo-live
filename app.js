(() => {
  const $ = id => document.getElementById(id);
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const startBtn = $("startBtn"), pauseBtn = $("pauseBtn");
  const statusText = $("statusText"), statusDot = $("statusDot");
  const supportNote = $("supportNote"), liveJapanese = $("liveJapanese"), liveKorean = $("liveKorean");
  const historyEl = $("history"), countLabel = $("countLabel");
  let recognition = null, running = false, manuallyStopped = false;
  let finalBuffer = "", interimText = "", translationTimer = null, requestId = 0;
  let lastCommitted = "", history = [];
  try { history = JSON.parse(localStorage.getItem("nihongo-live-history") || "[]"); } catch {}
  renderHistory();

  function setStatus(text, active=false) {
    statusText.textContent = text;
    statusDot.classList.toggle("active", active);
  }
  function renderHistory() {
    historyEl.innerHTML = "";
    history.forEach(item => {
      const card = document.createElement("article");
      card.className = "history-item";
      const ja = document.createElement("p"); ja.className = "ja"; ja.textContent = item.ja;
      const ko = document.createElement("p"); ko.className = "ko"; ko.textContent = item.ko;
      const time = document.createElement("time"); time.textContent = item.time;
      card.append(ja, ko, time); historyEl.append(card);
    });
    countLabel.textContent = `${history.length}개 문장`;
  }
  function persist() {
    try { localStorage.setItem("nihongo-live-history", JSON.stringify(history.slice(-150))); } catch {}
  }
  function speakKorean(text) {
    if (!$("speakToggle").checked || !("speechSynthesis" in window) || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR"; utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  }
  async function translate(text, isFinal=false) {
    const clean = text.trim();
    if (!clean) return;
    const id = ++requestId;
    liveJapanese.textContent = clean;
    liveKorean.textContent = isFinal ? "번역 중…" : "번역 중…";
    try {
      // MyMemory public translation endpoint: Japanese -> Korean.
      const url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(clean.slice(0, 450)) + "&langpair=ja|ko";
      const response = await fetch(url);
      if (!response.ok) throw new Error("번역 서버 응답 오류");
      const data = await response.json();
      const translated = data?.responseData?.translatedText;
      if (!translated) throw new Error("번역 결과가 없습니다.");
      if (id !== requestId) return;
      const decoded = document.createElement("textarea");
      decoded.innerHTML = translated;
      const ko = decoded.value;
      liveKorean.textContent = ko;
      if (isFinal && clean !== lastCommitted) {
        lastCommitted = clean;
        history.push({ja: clean, ko, time: new Date().toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})});
        history = history.slice(-150); persist(); renderHistory();
        if ($("autoScrollToggle").checked) historyEl.lastElementChild?.scrollIntoView({behavior:"smooth",block:"end"});
        speakKorean(ko);
      }
    } catch (err) {
      if (id === requestId) liveKorean.textContent = "번역 오류: " + err.message;
    }
  }
  function queueInterimTranslation() {
    clearTimeout(translationTimer);
    const text = (finalBuffer + " " + interimText).trim();
    if (!text) return;
    translationTimer = setTimeout(() => translate(text, false), 650);
  }
  function setupRecognition() {
    if (!SpeechRecognition) {
      supportNote.textContent = "이 브라우저는 음성 인식을 지원하지 않습니다. iPhone은 Safari, Android는 Chrome 최신 버전에서 다시 시도해 주세요.";
      $("engineLabel").textContent = "음성 인식 미지원";
      startBtn.disabled = true; return false;
    }
    recognition = new SpeechRecognition();
    recognition.lang = "ja-JP";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => { setStatus("일본어 음성 듣는 중", true); supportNote.textContent = "일본어로 말하면 자동으로 인식하고 번역합니다."; };
    recognition.onresult = event => {
      interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalBuffer = (finalBuffer + " " + transcript).trim();
          clearTimeout(translationTimer);
          translate(finalBuffer, true);
          finalBuffer = "";
        } else interimText += transcript;
      }
      const current = (finalBuffer + " " + interimText).trim();
      if (current) {
        liveJapanese.textContent = current;
        queueInterimTranslation();
      }
    };
    recognition.onerror = event => {
      const messages = {
        "not-allowed":"마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크를 허용해 주세요.",
        "service-not-allowed":"브라우저 음성 인식 서비스가 차단되었습니다.",
        "no-speech":"음성이 감지되지 않았습니다. 계속 듣기를 시도합니다.",
        "network":"음성 인식 네트워크 오류입니다."
      };
      supportNote.textContent = messages[event.error] || `음성 인식 오류: ${event.error}`;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        manuallyStopped = true; running = false; setStatus("마이크 권한 확인 필요");
        startBtn.disabled = false; pauseBtn.disabled = true;
      }
    };
    recognition.onend = () => {
      if (running && !manuallyStopped) {
        setTimeout(() => { try { recognition.start(); } catch {} }, 350);
      } else {
        setStatus("일시정지"); startBtn.disabled = false; pauseBtn.disabled = true;
      }
    };
    $("engineLabel").textContent = "브라우저 음성 인식";
    return true;
  }
  startBtn.addEventListener("click", () => {
    if (!recognition && !setupRecognition()) return;
    manuallyStopped = false; running = true;
    startBtn.disabled = true; pauseBtn.disabled = false;
    try { recognition.start(); } catch (e) { supportNote.textContent = "음성 인식을 시작할 수 없습니다. 잠시 후 다시 눌러 주세요."; startBtn.disabled=false; pauseBtn.disabled=true; }
  });
  pauseBtn.addEventListener("click", () => {
    manuallyStopped = true; running = false;
    if (recognition) recognition.stop();
    clearTimeout(translationTimer);
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  });
  $("clearBtn").addEventListener("click", () => {
    if (!confirm("번역 기록을 모두 지울까요?")) return;
    history = []; persist(); renderHistory();
    liveJapanese.textContent = "일본어 음성이 여기에 표시됩니다.";
    liveKorean.textContent = "번역 결과가 여기에 표시됩니다.";
  });

  let deferredPrompt;
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault(); deferredPrompt = e; $("installBtn").hidden = false;
  });
  $("installBtn").addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $("installBtn").hidden = true;
  });
  if (!window.isSecureContext && location.hostname !== "localhost") {
    supportNote.textContent = "마이크 사용을 위해 HTTPS 주소로 접속해야 합니다.";
  }
  if (!SpeechRecognition) {
    $("engineLabel").textContent = "지원 브라우저 확인 필요";
    supportNote.textContent = "이 브라우저에서 음성 인식 기능을 사용할 수 없습니다. iPhone은 Safari, Android는 Chrome을 권장합니다.";
    startBtn.disabled = true;
  }
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
})();