// 사용자 정보 (실제로는 로그인 후 받아올 데이터)
const mockUser = {
  name: "김진영",
  email: "jinyoung@example.com",
  initials: "JY",
};

// 회의 데이터
const mockMeetings = {
  "2026-02-03": [
    {
      id: 1,
      title: "분기별 전략 회의",
      startTime: "10:00",
      endTime: "11:00",
      room: "회의실 A",
      participants: 5,
    },
    {
      id: 2,
      title: "프로젝트 진행 현황",
      startTime: "14:00",
      endTime: "15:00",
      room: "회의실 B",
      participants: 3,
    },
  ],
  "2026-02-04": [
    {
      id: 3,
      title: "클라이언트 미팅",
      startTime: "09:00",
      endTime: "10:30",
      room: "회의실 C",
      participants: 4,
    },
  ],
};

// 캘린더 관련 변수
let currentDate = new Date();
let selectedDate = new Date(2026, 1, 3); // 2026-02-03

// DOM 요소
const userNameEl = document.getElementById("userName");
const userEmailEl = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");
const calendarDaysEl = document.getElementById("calendarDays");
const currentMonthEl = document.getElementById("currentMonth");
const prevMonthBtn = document.getElementById("prevMonthBtn");
const nextMonthBtn = document.getElementById("nextMonthBtn");
const meetingsContainerEl = document.getElementById("meetingsContainer");
const selectedDateTitleEl = document.getElementById("selectedDateTitle");
const meetingScreenEl = document.getElementById("meetingScreen");
const meetingTitleTextEl = document.getElementById("meetingTitleText");
const leaveMeetingBtn = document.getElementById("leaveMeetingBtn");
const glossaryFeedEl = document.getElementById("glossaryFeed");
const cameraToggleBtn = document.getElementById("cameraToggleBtn");
const localVideoEl = document.getElementById("localVideo");
const meetingVideoMainEl = document.getElementById("meetingVideoMain");
const videoOffOverlayEl = document.getElementById("videoOffOverlay");
let glossaryTimer = null;
let glossaryStartTimeout = null;
let glossaryIndex = 0;
let glossaryItems = [];
let cameraStream = null;
let isCameraOn = false;
let meetingStartedAt = null;
let activeMeetingTitle = null;

// 초기화
document.addEventListener("DOMContentLoaded", () => {
  initUser();
  initCalendar();
  initQuickActions();
  initModalEvents();
  initReportButtons();
  initMeetingScreen();
  loadReportHistoryToCarousel();
  refreshCarouselElements();
  updateCarousel();
});

// 사용자 정보 초기화
function initUser() {
  userNameEl.textContent = mockUser.name;
  userEmailEl.textContent = mockUser.email;
}

// 캘린더 초기화
function initCalendar() {
  renderCalendar();
  updateMeetingsList(selectedDate);
}

// 캘린더 렌더링
function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // 현재 월 표시
  const monthNames = [
    "1월",
    "2월",
    "3월",
    "4월",
    "5월",
    "6월",
    "7월",
    "8월",
    "9월",
    "10월",
    "11월",
    "12월",
  ];
  currentMonthEl.textContent = `${year}년 ${monthNames[month]}`;

  // 첫 날 및 마지막 날 계산
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const prevLastDate = new Date(year, month, 0).getDate();

  calendarDaysEl.innerHTML = "";

  // 이전 달의 날짜들
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = prevLastDate - i;
    const dayEl = createDayElement(day, true);
    calendarDaysEl.appendChild(dayEl);
  }

  // 현재 달의 날짜들
  for (let day = 1; day <= lastDate; day++) {
    const dayEl = createDayElement(day, false, year, month);
    calendarDaysEl.appendChild(dayEl);
  }

  // 다음 달의 날짜들
  const totalCells = calendarDaysEl.children.length;
  const remainingCells = 42 - totalCells;
  for (let day = 1; day <= remainingCells; day++) {
    const dayEl = createDayElement(day, true);
    calendarDaysEl.appendChild(dayEl);
  }
}

// 날짜 요소 생성
function createDayElement(day, isOtherMonth, year, month) {
  const dayEl = document.createElement("div");
  dayEl.className = "day";
  dayEl.textContent = day;

  if (isOtherMonth) {
    dayEl.classList.add("other-month");
    return dayEl;
  }

  const dateStr = formatDate(new Date(year, month, day));

  // 오늘인 경우
  if (dateStr === formatDate(new Date())) {
    dayEl.classList.add("today");
  }

  // 선택된 날짜인 경우
  if (dateStr === formatDate(selectedDate)) {
    dayEl.classList.add("selected");
  }

  // 회의가 있는 경우
  if (mockMeetings[dateStr]) {
    dayEl.classList.add("has-meeting");
  }

  // 클릭 이벤트
  dayEl.addEventListener("click", () => {
    document.querySelectorAll(".day.selected").forEach((el) => {
      el.classList.remove("selected");
    });
    dayEl.classList.add("selected");
    selectedDate = new Date(year, month, day);
    updateMeetingsList(selectedDate);
  });

  return dayEl;
}

// 날짜 포맷 (YYYY-MM-DD)
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 회의 목록 업데이트
function updateMeetingsList(date) {
  const dateStr = formatDate(date);
  const dateFormatted = new Date(date).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  selectedDateTitleEl.textContent = `${dateFormatted}의 회의`;

  const meetings = mockMeetings[dateStr] || [];

  if (meetings.length === 0) {
    meetingsContainerEl.innerHTML =
      '<p style="text-align: center; color: #999; padding: 20px;">예약된 회의가 없습니다.</p>';
    return;
  }

  meetingsContainerEl.innerHTML = meetings
    .map(
      (meeting) => `
        <div class="meeting-item">
            <div class="meeting-time">${meeting.startTime} - ${meeting.endTime}</div>
            <div class="meeting-details">
                <h4>${meeting.title}</h4>
                <p>${meeting.room} · 참가자 ${meeting.participants}명</p>
            </div>
            <button class="join-meeting-btn" onclick="joinMeeting(${meeting.id})">참가</button>
        </div>
    `,
    )
    .join("");
}

// 빠른 작업 이벤트
function initQuickActions() {
  document.getElementById("joinMeetingCard").addEventListener("click", () => {
    openModal("joinModal");
  });

  document
    .getElementById("scheduleMeetingCard")
    .addEventListener("click", () => {
      // 스케줄 기능 구현
      alert("회의 예약 기능은 준비 중입니다.");
    });

  document.getElementById("createMeetingCard").addEventListener("click", () => {
    openModal("createModal");
  });
}

// 모달 이벤트
function initModalEvents() {
  // 회의 참가 모달
  document.getElementById("joinModalClose").addEventListener("click", () => {
    closeModal("joinModal");
  });

  document.getElementById("joinModalCancel").addEventListener("click", () => {
    closeModal("joinModal");
  });

  document.getElementById("joinModalConfirm").addEventListener("click", () => {
    const code = document.getElementById("meetingCode").value.trim();
    if (code) {
      // 모달 닫기
      closeModal("joinModal");
      document.getElementById("meetingCode").value = "";

      // 3D 지구본 애니메이션 표시
      startJoinFlow(`회의 코드 ${code}의 회의`);
    } else {
      alert("회의 코드를 입력해주세요.");
    }
  });

  // 회의 생성 모달
  document.getElementById("createModalClose").addEventListener("click", () => {
    closeModal("createModal");
  });

  document.getElementById("createModalCancel").addEventListener("click", () => {
    closeModal("createModal");
  });

  document
    .getElementById("createModalConfirm")
    .addEventListener("click", () => {
      const title = document.getElementById("meetingTitle").value.trim();
      const desc = document.getElementById("meetingDesc").value.trim();
      const duration = document.getElementById("meetingDuration").value;

      if (title) {
        // 실제 회의 생성 로직
        alert(`회의 "${title}"을(를) 생성했습니다. (${duration}분)`);
        closeModal("createModal");

        // 폼 초기화
        document.getElementById("meetingTitle").value = "";
        document.getElementById("meetingDesc").value = "";
        document.getElementById("meetingDuration").value = "60";
      } else {
        alert("회의 제목을 입력해주세요.");
      }
    });

  // 모달 배경 클릭하여 닫기
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("active");
      }
    });
  });
}

// 모달 열기
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.add("active");
}

// 모달 닫기
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove("active");
}

// 월 네비게이션
prevMonthBtn.addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
});

nextMonthBtn.addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
});

// 회의 참가
function joinMeeting(meetingId) {
  const meetingTitle = findMeetingTitleById(meetingId) || "회의 진행 중";
  startJoinFlow(meetingTitle);
}

// 보고서 버튼 이벤트
function initReportButtons() {
  const carouselContainer = document.getElementById("carouselTrack");
  if (!carouselContainer) return;
  carouselContainer.addEventListener("click", (e) => {
    const button = e.target.closest(".report-button");
    if (!button) return;
    const reportId = button.dataset.reportId;
    openReport(reportId);
  });
}

// 보고서 열기
function openReport(reportId) {
  // 보고서 페이지로 이동
  window.location.href = `report.html?id=${encodeURIComponent(reportId)}`;
}

// 3D 지구본 애니메이션 표시
function showGlobeAnimation() {
  const globeOverlay = document.getElementById("globeOverlay");
  globeOverlay.classList.add("active");
}

// 3D 지구본 애니메이션 숨기기
function hideGlobeAnimation() {
  const globeOverlay = document.getElementById("globeOverlay");
  globeOverlay.classList.remove("active");
}

// ===== 회의 화면 =====
function initMeetingScreen() {
  leaveMeetingBtn.addEventListener("click", () => {
    closeMeetingScreen();
  });

  cameraToggleBtn.addEventListener("click", () => {
    toggleCamera();
  });
}

function startJoinFlow(meetingTitle) {
  showGlobeAnimation();

  setTimeout(() => {
    hideGlobeAnimation();
    openMeetingScreen(meetingTitle);
  }, 1500);
}

function openMeetingScreen(meetingTitle) {
  meetingTitleTextEl.textContent = meetingTitle;
  meetingScreenEl.classList.add("active");
  document.body.classList.add("meeting-open");
  meetingStartedAt = new Date();
  activeMeetingTitle = meetingTitle;
  startGlossarySimulation();
  startCamera();
}

function closeMeetingScreen() {
  const generatedReport = buildGeneratedReport();
  meetingScreenEl.classList.remove("active");
  document.body.classList.remove("meeting-open");
  stopGlossarySimulation();
  stopCamera();
  if (generatedReport) {
    appendReportHistory(generatedReport);
    localStorage.setItem(
      "javaZoom.latestReport",
      JSON.stringify(generatedReport),
    );
    openReport("generated");
  }
}

function findMeetingTitleById(meetingId) {
  const meetings = Object.values(mockMeetings).flat();
  const meeting = meetings.find((item) => item.id === meetingId);
  return meeting?.title;
}

function startGlossarySimulation() {
  stopGlossarySimulation();
  glossaryItems = [];
  glossaryFeedEl.innerHTML =
    '<div class="glossary-item muted">대화를 분석 중입니다. 약 10초 후 전문용어가 표시됩니다.</div>';

  const terms = [
    {
      term: "API 게이트웨이",
      desc: "클라이언트 요청을 통합 진입점에서 라우팅·인증·모니터링합니다.",
    },
    {
      term: "마이크로서비스 아키텍처(MSA)",
      desc: "서비스를 독립 배포 단위로 분리해 유연성과 확장성을 높입니다.",
    },
    {
      term: "레거시 시스템 마이그레이션",
      desc: "기존 시스템을 신규 플랫폼으로 단계적으로 이전하는 작업입니다.",
    },
  ];

  // ✅ 입장 후 정확한 초에 뜨게: 15s / 21s / 25s
  const scheduleMs = [15000, 21000, 25000];

  // 기존 interval/timer 방식 대신, timeout들을 배열로 관리
  glossaryTimer = scheduleMs.map((ms, i) =>
    setTimeout(() => {
      const item = terms[i];
      if (!item) return;
      appendGlossaryItem(item.term, item.desc);
    }, ms),
  );
}

function stopGlossarySimulation() {
  // glossaryTimer가 배열이면 timeout들 전부 해제
  if (Array.isArray(glossaryTimer)) {
    glossaryTimer.forEach((t) => clearTimeout(t));
  } else if (glossaryTimer) {
    // 혹시 이전 구현 잔재 방어
    clearInterval(glossaryTimer);
    clearTimeout(glossaryTimer);
  }
  glossaryTimer = null;

  if (glossaryStartTimeout) {
    clearTimeout(glossaryStartTimeout);
    glossaryStartTimeout = null;
  }
}

function appendGlossaryItem(term, desc) {
  const mutedItem = glossaryFeedEl.querySelector(".glossary-item.muted");
  if (mutedItem) {
    mutedItem.remove();
  }

  const wrapper = document.createElement("div");
  wrapper.className = "glossary-item";
  wrapper.innerHTML = `<strong>${term}</strong>${desc}`;
  glossaryFeedEl.appendChild(wrapper);
  glossaryItems.push(wrapper);

  if (glossaryItems.length > 8) {
    const removed = glossaryItems.shift();
    removed?.remove();
  }

  glossaryFeedEl.scrollTop = glossaryFeedEl.scrollHeight;
}

function buildGeneratedReport() {
  const startedAt = meetingStartedAt || new Date();
  const endedAt = new Date();
  const reportId = `generated-${endedAt.getTime()}`;
  const durationMinutes = Math.max(
    1,
    Math.round((endedAt.getTime() - startedAt.getTime()) / 60000),
  );

  const participants = [
    { name: "김진영", role: "PM", status: "참석" },
    { name: "이수진", role: "기획", status: "참석" },
    { name: "박준호", role: "데이터", status: "참석" },
    { name: "최민지", role: "운영", status: "참석" },
    { name: "정연호", role: "개발", status: "참석" },
  ];

  return {
    id: reportId,
    title: "SK AX 신 사업 프로젝트 회의",
    meetingTitle: activeMeetingTitle || "회의 진행 중",
    startISO: startedAt.toISOString(),
    endISO: endedAt.toISOString(),
    durationMinutes,
    location: "온라인",
    participants,
    summary: {
      topics: [
        "○○은행 차세대 시스템 구축 건의 API 게이트웨이 설계 단계 완료",
        "예상 매출은 [삐—]억 원으로 산정(대외비로 비공개)",
        "마이크로서비스 아키텍처(MSA) 기반으로 프로젝트 진행 중",
        "고객사 [삐—] 측 PM 요청으로 레거시 시스템 마이그레이션 일정 2주 앞당김 필요",
        "일정 변경에 따른 내부 리소스 재조정 및 영향도 점검 필요",
      ],
      decisions: [
        "매출액 및 고객사명은 계약 기밀로 분류해 문서/공유 범위 제한",
        "마이그레이션 일정 당김에 대한 영향도 분석을 48시간 내 공유",
        "API 게이트웨이 상세 설계 리뷰를 이번 주 내 완료",
      ],
      nextMeeting: "다음 주 화요일 10:00 - 11:00 / 온라인",
    },
    actionItems: [
      {
        id: 1,
        status: "진행 중",
        task: "일정 변경 영향도(인력/리스크) 분석 보고",
        owner: "정연호",
        deadline: "48시간 내",
      },
      {
        id: 2,
        status: "진행 중",
        task: "API 게이트웨이 상세 설계 리뷰 자료 준비",
        owner: "박준호",
        deadline: "이번 주 목요일",
      },
      {
        id: 3,
        status: "진행 중",
        task: "레거시 시스템 마이그레이션 일정 재조정안 수립",
        owner: "이수진",
        deadline: "이번 주 금요일",
      },
    ],
  };
}

function getReportHistory() {
  const stored = localStorage.getItem("javaZoom.reportHistory");
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (error) {
    return [];
  }
}

function appendReportHistory(report) {
  const history = getReportHistory();
  const filtered = history.filter((item) => item.id !== report.id);
  const updated = [report, ...filtered].slice(0, 5);
  localStorage.setItem("javaZoom.reportHistory", JSON.stringify(updated));
  prependReportCard(report);
}

function loadReportHistoryToCarousel() {
  const history = getReportHistory();
  if (history.length === 0) return;

  history
    .slice()
    .reverse()
    .forEach((report) => {
      prependReportCard(report, true);
    });
}

function prependReportCard(report, skipRefresh = false) {
  const carouselTrackEl = document.getElementById("carouselTrack");
  if (!carouselTrackEl) return;

  const card = createReportCardElement(report);
  carouselTrackEl.prepend(card);

  if (!skipRefresh) {
    currentSlide = 0;
    refreshCarouselElements();
    updateCarousel();
  }
}

function createReportCardElement(report) {
  const start = new Date(report.startISO);
  const end = new Date(report.endISO);
  const durationText = formatReportDuration(
    report.durationMinutes || getDurationMinutes(start, end),
  );
  const timeRange = `${formatReportTime(start)} - ${formatReportTime(end)}`;
  const participantNames = report.participants
    .map((person) => person.name)
    .slice(0, 5)
    .map((name) => `<span>${name}</span>`)
    .join("");
  const summaryText =
    report.summary?.topics?.[0] || "회의 요약이 준비 중입니다.";

  const card = document.createElement("div");
  card.className = "report-card carousel-slide";
  card.dataset.reportId = report.id;
  card.innerHTML = `
    <div class="report-header">
      <div class="report-date">${formatReportDate(end)}</div>
      <h3 class="report-title">${report.title}</h3>
    </div>

    <div class="report-info-grid">
      <div class="info-item">
        <span class="info-label">회의 시간</span>
        <span class="info-value">${durationText}</span>
      </div>
      <div class="info-item">
        <span class="info-label">시작 시간</span>
        <span class="info-value">${timeRange}</span>
      </div>
    </div>

    <div class="report-info-grid">
      <div class="info-item">
        <span class="info-label">장소</span>
        <span class="info-value">${report.location || "온라인"}</span>
      </div>
      <div class="info-item">
        <span class="info-label">참가자</span>
        <span class="info-value">${report.participants.length}명</span>
      </div>
    </div>

    <div class="report-stats-grid">
      <div class="stat-item safe">
        <span class="stat-label">안전도</span>
        <span class="stat-value">98%</span>
      </div>
      <div class="stat-item alert">
        <span class="stat-label">민감 정보</span>
        <span class="stat-value">2건</span>
      </div>
    </div>

    <div class="report-participants">
      <span class="info-label">참가자 명단</span>
      <div class="participants-list">
        ${participantNames}
      </div>
    </div>

    <div class="report-summary">
      <span class="info-label">회의 요약</span>
      <p>${summaryText}</p>
    </div>

    <button class="report-button" data-report-id="${report.id}">
      상세 보고서 보기
    </button>
  `;

  return card;
}

function formatReportDate(date) {
  return formatDate(date);
}

function formatReportTime(date) {
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getDurationMinutes(start, end) {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
}

function formatReportDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) {
    return `${hours}시간 ${mins}분`;
  }
  if (hours > 0) {
    return `${hours}시간`;
  }
  return `${mins}분`;
}

async function startCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    localVideoEl.srcObject = cameraStream;
    isCameraOn = true;
    meetingVideoMainEl.classList.remove("is-off");
    videoOffOverlayEl.textContent = "";
    cameraToggleBtn.classList.remove("is-off");
    cameraToggleBtn.classList.add("is-on");
  } catch (error) {
    isCameraOn = false;
    meetingVideoMainEl.classList.add("is-off");
    videoOffOverlayEl.textContent = "카메라 권한이 필요합니다.";
    cameraToggleBtn.classList.add("is-off");
    cameraToggleBtn.classList.remove("is-on");
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  localVideoEl.srcObject = null;
  isCameraOn = false;
  meetingVideoMainEl.classList.add("is-off");
  videoOffOverlayEl.textContent = "카메라가 꺼져 있습니다.";
  cameraToggleBtn.classList.add("is-off");
  cameraToggleBtn.classList.remove("is-on");
}

function toggleCamera() {
  if (isCameraOn) {
    stopCamera();
  } else {
    startCamera();
  }
}

// ===== 캐러셀 기능 =====
let currentSlide = 0;
let slides = [];
let totalSlides = 0;
const carouselTrack = document.getElementById("carouselTrack");
const carouselPrevBtn = document.getElementById("carouselPrev");
const carouselNextBtn = document.getElementById("carouselNext");
let indicators = [];
const carouselIndicators = document.getElementById("carouselIndicators");

function refreshCarouselElements() {
  slides = Array.from(document.querySelectorAll(".carousel-slide"));
  totalSlides = slides.length;
  rebuildIndicators();
}

function rebuildIndicators() {
  if (!carouselIndicators) return;
  carouselIndicators.innerHTML = "";
  indicators = slides.map((_, index) => {
    const indicator = document.createElement("span");
    indicator.className = `indicator${index === currentSlide ? " active" : ""}`;
    indicator.dataset.slide = index;
    indicator.addEventListener("click", () => {
      currentSlide = index;
      updateCarousel();
    });
    carouselIndicators.appendChild(indicator);
    return indicator;
  });
}

function updateCarousel() {
  if (!carouselTrack || totalSlides === 0) {
    return;
  }
  const offset = -currentSlide * 100;
  carouselTrack.style.transform = `translateX(${offset}%)`;

  // 버튼 비활성화 상태 업데이트
  carouselPrevBtn.disabled = currentSlide === 0;
  carouselNextBtn.disabled = currentSlide === totalSlides - 1;

  // 인디케이터 업데이트
  indicators.forEach((indicator, index) => {
    indicator.classList.toggle("active", index === currentSlide);
  });
}

function nextSlide() {
  if (currentSlide < totalSlides - 1) {
    currentSlide++;
    updateCarousel();
  }
}

function prevSlide() {
  if (currentSlide > 0) {
    currentSlide--;
    updateCarousel();
  }
}

// 캐러셀 버튼 이벤트
carouselNextBtn.addEventListener("click", nextSlide);
carouselPrevBtn.addEventListener("click", prevSlide);

// 초기 상태 설정
refreshCarouselElements();
updateCarousel();

// 로그아웃
logoutBtn.addEventListener("click", () => {
  if (confirm("로그아웃 하시겠습니까?")) {
    localStorage.removeItem("userEmail");
    localStorage.removeItem("rememberMe");
    window.location.href = "index.html";
  }
});

(() => {
  // ====== 설정 ======
  const WS_URL = "ws://localhost:8000/ws/meeting";
  const TARGET_SR = 16000;
  const FRAME_MS = 20;
  const FRAME_SAMPLES = (TARGET_SR * FRAME_MS) / 1000; // 320
  const SAFETY_DELAY = 0.8; // 재생 끊김 방지 버퍼(초)

  // ====== DOM ======
  const btnMic = document.getElementById("btnMic"); // 🎙️ 버튼
  const transcriptBody = document.querySelector(".transcript-body");

  if (!btnMic) {
    console.error("[meeting-filter] #btnMic(🎙️) 버튼을 찾지 못했습니다.");
    return;
  }
  if (!transcriptBody) {
    console.error("[meeting-filter] .transcript-body를 찾지 못했습니다.");
    return;
  }

  setMicButtonOn(false);

  // ====== 상태 ======
  let ws = null;
  let isRunning = false;

  // mic capture
  let micCtx = null;
  let source = null;
  let processor = null;
  let stream = null;

  // playback
  let playCtx = null;
  let playerNode = null;

  // transcript
  let transcriptInitialized = false;
  const MAX_TRANSCRIPT_LINES = 5;
  const transcriptLines = []; // { text, norm, }

  function normalizeLine(text) {
    return String(text ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase(); // 대소문자 구분 없이 비교
  }

  function renderTextWithBleep(containerEl, text) {
    // "삐-" 처리된 단어는 화면에서 굵게(bold) 표시
    // 안전하게 DOM 노드로 구성 (innerHTML 직접 주입 X)
    containerEl.textContent = "";

    const raw = String(text ?? "");
    const regex = /(삐-[^\s]+)/g;
    let lastIdx = 0;
    let match;

    while ((match = regex.exec(raw)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      if (start > lastIdx) {
        containerEl.appendChild(
          document.createTextNode(raw.slice(lastIdx, start)),
        );
      }

      const strong = document.createElement("strong");
      strong.textContent = match[0];
      containerEl.appendChild(strong);

      lastIdx = end;
    }

    if (lastIdx < raw.length) {
      containerEl.appendChild(document.createTextNode(raw.slice(lastIdx)));
    }
  }

  // ====== UI helpers ======
  function appendTranscript(meta) {
    if (!transcriptBody) return;

    // ✅ 1. 빈 메타데이터나 음성 없을 때 필터링
    if (!meta) return;

    // 문자열이 아닌 객체인 경우 텍스트 추출
    let line = "";
    if (typeof meta === "string") {
      line = meta;
    } else if (typeof meta === "object") {
      // safe_text나 raw_text가 없거나 비어있으면 무시
      line = meta.safe_text || meta.raw_text || "";

      // ✅ 메타데이터만 있고 실제 텍스트가 없으면 무시
      if (!line || line.trim() === "") return;
    } else {
      return;
    }

    console.log(meta);

    const norm = normalizeLine(line);

    // ✅ 2. 빈 텍스트 필터링
    if (!norm || norm.length < 2) return; // 최소 2글자 이상만 허용

    if (!transcriptInitialized) {
      transcriptBody.textContent = ""; // 초기 안내 문구 제거
      transcriptInitialized = true;
    }

    const now = Date.now();

    // ✅ 3. 강화된 중복 방지 로직
    // 3-1. 마지막 3줄 내에서 완전 동일한 문장 체크
    const recentLines = transcriptLines.slice(-3);
    if (recentLines.some((l) => l.norm === norm)) {
      console.log("[중복 무시]", norm);
      return;
    }

    // 3-2. 마지막 줄과 비교
    const last = transcriptLines[transcriptLines.length - 1];
    if (last) {
      // 시간 차이가 1초 미만이고 유사도가 높으면 업데이트로 처리
      const timeDiff = now - last.timestamp;

      if (timeDiff < 1000) {
        // 1초 이내
        // 마지막 줄이 현재 줄에 포함되어 있으면 (점진적 업데이트)
        if (norm.includes(last.norm) || last.norm.includes(norm)) {
          // 더 긴 텍스트로 업데이트
          if (norm.length > last.norm.length) {
            last.text = line;
            last.norm = norm;
            last.timestamp = now;
            renderTranscript();
            return;
          } else {
            // 짧거나 같으면 무시
            return;
          }
        }
      }

      // 완전히 동일한 문장은 무시
      if (norm === last.norm) {
        return;
      }
    }

    // ✅ 4. 새 줄 추가
    transcriptLines.push({
      text: line,
      norm: norm,
      timestamp: now,
    });

    renderTranscript();
  }

  // ✅ 렌더링 함수 분리 (재사용성 향상)
  function renderTranscript() {
    if (!transcriptBody) return;

    transcriptBody.textContent = "";

    for (const item of transcriptLines) {
      const div = document.createElement("div");
      div.className = "transcript-line";
      renderTextWithBleep(div, item.text);
      transcriptBody.appendChild(div);
    }

    // 스크롤을 맨 아래로
    transcriptBody.scrollTop = transcriptBody.scrollHeight;
  }

  function setMicButtonOn(on) {
    // on/off 둘 다 상태가 명확히 보이도록
    btnMic.classList.toggle("is-on", on);
    btnMic.classList.toggle("is-off", !on);

    // (선택) 접근성: 상태 표시
    btnMic.setAttribute("aria-pressed", String(on));
  }

  // ====== Audio utils ======
  function downsampleBuffer(buffer, inputSampleRate, outputSampleRate) {
    if (outputSampleRate === inputSampleRate) return buffer;
    const sampleRateRatio = inputSampleRate / outputSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);

    let offsetResult = 0;
    let offsetBuffer = 0;

    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0;
      let count = 0;

      for (
        let i = offsetBuffer;
        i < nextOffsetBuffer && i < buffer.length;
        i++
      ) {
        accum += buffer[i];
        count++;
      }

      result[offsetResult] = accum / Math.max(1, count);
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }

    return result;
  }

  function floatTo16BitPCM(float32) {
    const out = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      let s = Math.max(-1, Math.min(1, float32[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }

  function pcm16ToFloat32(arrayBuffer) {
    const i16 = new Int16Array(arrayBuffer);
    const f32 = new Float32Array(i16.length);
    for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 32768.0;
    return f32;
  }

  function resampleFloat32Linear(input, inRate, outRate) {
    if (inRate === outRate) return input;
    const ratio = outRate / inRate;
    const outLen = Math.floor(input.length * ratio);
    const out = new Float32Array(outLen);

    for (let i = 0; i < outLen; i++) {
      const t = i / ratio;
      const i0 = Math.floor(t);
      const i1 = Math.min(input.length - 1, i0 + 1);
      const frac = t - i0;
      out[i] = input[i0] * (1 - frac) + input[i1] * frac;
    }
    return out;
  }


  function pushPcmToPlayer(pcmArrayBuffer) {
    if (!playerNode || !playCtx) return;

    const f32_16k = pcm16ToFloat32(pcmArrayBuffer);
    const outRate = playCtx.sampleRate;   // ✅ 실제 재생 샘플레이트(대부분 48000)
    const f32_out = resampleFloat32Linear(f32_16k, 16000, outRate);

    playerNode.port.postMessage(f32_out, [f32_out.buffer]);
  }
  function waitForWsOpen(socket) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const timer = setInterval(() => {
        if (!socket) {
          clearInterval(timer);
          reject(new Error("WebSocket is null"));
          return;
        }
        if (socket.readyState === 1) {
          clearInterval(timer);
          resolve();
          return;
        }
        if (socket.readyState === 3) {
          clearInterval(timer);
          reject(new Error("WebSocket closed"));
          return;
        }
        // 5초 타임아웃
        if (Date.now() - start > 5000) {
          clearInterval(timer);
          reject(new Error("WebSocket open timeout"));
        }
      }, 50);
    });
  }

  // ====== Start/Stop ======
  async function start() {
    // 1. WebSocket 연결
    ws = new WebSocket(WS_URL);
    ws.binaryType = "arraybuffer";

    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        try {
          appendTranscript(JSON.parse(ev.data));
        } catch { }
      } else {
        pushPcmToPlayer(ev.data);
      }
    };

    ws.onerror = () => {
      console.error("[meeting-filter] WebSocket error occurred.");
    };

    await waitForWsOpen(ws);

    // 2. play AudioContext (재생 전용) 생성 및 활성화
    playCtx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: TARGET_SR,
    });

    console.log("TARGET_SR=", TARGET_SR, "playCtx.sampleRate=", playCtx.sampleRate);



    // 크롬 자동 재생 정책 대응
    if (playCtx.state === 'suspended') {
      await playCtx.resume();
    }

    try {
      await playCtx.audioWorklet.addModule("./pcm-player-worklet.js");
    } catch (e) {
      console.error("Playback AudioWorklet 로딩 실패:", e);
      return;
    }

    playerNode = new AudioWorkletNode(playCtx, "pcm-player", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
    playerNode.connect(playCtx.destination);

    // 3. mic AudioContext (캡처 전용) 및 스트림 설정
    micCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });

    // AudioWorklet 모듈 로드 
    try {
      await micCtx.audioWorklet.addModule('./processor-worker.js');
    } catch (e) {
      console.error("AudioWorklet 로딩 실패. 경로를 확인하세요:", e);
      return;
    }

    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    source = micCtx.createMediaStreamSource(stream);

    // 4. AudioWorkletNode 생성 (기존 ScriptProcessor 대체)
    const workletNode = new AudioWorkletNode(micCtx, 'audio-processor');

    let carry = new Float32Array(0);

    // 워커에서 보내주는 오디오 데이터를 서버로 전송하는 로직
    workletNode.port.onmessage = (event) => {
      if (!ws || ws.readyState !== 1) return;

      const input = event.data; // Float32Array
      const inputSR = micCtx.sampleRate;

      // 다운샘플링 및 프레임 분할 전송
      const down = downsampleBuffer(input, inputSR, TARGET_SR);

      const merged = new Float32Array(carry.length + down.length);
      merged.set(carry, 0);
      merged.set(down, carry.length);

      let offset = 0;
      while (offset + FRAME_SAMPLES <= merged.length) {
        const frame = merged.slice(offset, offset + FRAME_SAMPLES);
        const pcm16 = floatTo16BitPCM(frame);
        ws.send(pcm16.buffer);
        offset += FRAME_SAMPLES;
      }
      carry = merged.slice(offset);
    };

    // 5. 노드 연결 (스피커 출력 방지를 위해 zeroGain 사용)
    const zeroGain = micCtx.createGain();
    zeroGain.gain.value = 0;

    source.connect(workletNode);
    workletNode.connect(zeroGain);
    zeroGain.connect(micCtx.destination);

    // 전역 변수 할당 (나중에 중지할 때 필요)
    processor = workletNode;

    isRunning = true;
    setMicButtonOn(true);
  }

  async function stop() {
    try {
      if (processor) processor.disconnect();
    } catch { }
    try {
      if (source) source.disconnect();
    } catch { }
    try {
      if (micCtx) await micCtx.close();
    } catch { }
    try {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    } catch { }

    try {
      if (ws) ws.close();
    } catch { }

    try {
      if (playCtx) await playCtx.close();
    } catch { }

    ws = null;
    micCtx = null;
    source = null;
    processor = null;
    stream = null;
    playCtx = null;

    isRunning = false;
    setMicButtonOn(false);
  }

  // ====== 이벤트: 🎙️ 토글 ======
  btnMic.addEventListener("click", async () => {
    try {
      if (!isRunning) await start();
      else await stop();
    } catch (err) {
      console.error(err);
      try {
        await stop();
      } catch { }
    }
  });
})();
