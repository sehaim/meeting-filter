// URL에서 보고서 ID 가져오기
const urlParams = new URLSearchParams(window.location.search);
const reportId = urlParams.get("id") || "1";

// 보고서 데이터 (실제로는 API에서 가져올 데이터)
const reportData = {
  1: {
    title: "분기별 전략 회의",
    date: "2026년 2월 2일",
    time: "10:00 - 11:15",
    duration: "1시간 15분",
    participants: 5,
    location: "회의실 A",
  },
  2: {
    title: "팀 미팅",
    date: "2026년 2월 1일",
    time: "14:00 - 14:45",
    duration: "45분",
    participants: 3,
    location: "온라인",
  },
  3: {
    title: "클라이언트 회의",
    date: "2026년 1월 31일",
    time: "09:00 - 11:00",
    duration: "2시간",
    participants: 4,
    location: "회의실 B",
  },
};

let isGeneratedReport = false;

// 초기화
document.addEventListener("DOMContentLoaded", () => {
  loadReportData();
  initButtons();
  if (!isGeneratedReport) {
    setGeneratedDate();
  }
});

// 보고서 데이터 로드
function loadReportData() {
  if (reportId.startsWith("generated")) {
    const generated = findGeneratedReport(reportId);
    if (generated) {
      isGeneratedReport = true;
      renderGeneratedReport(generated);
      return;
    }
  }

  const data = reportData[reportId];

  if (data) {
    document.getElementById("meetingTitle").textContent = data.title;
    document.getElementById("meetingDate").textContent = data.date;
    document.getElementById("meetingTime").textContent = data.time;
    document.getElementById("meetingDuration").textContent = data.duration;
    document.getElementById("participants").textContent =
      data.participants + "명";
    document.getElementById("location").textContent = data.location;
  }
}

function findGeneratedReport(targetId) {
  const historyRaw = localStorage.getItem("javaZoom.reportHistory");
  if (historyRaw) {
    try {
      const history = JSON.parse(historyRaw);
      const found = history.find((item) => item.id === targetId);
      if (found) return found;
    } catch (error) {
      // ignore parse errors
    }
  }

  const latestRaw = localStorage.getItem("javaZoom.latestReport");
  if (latestRaw) {
    try {
      const latest = JSON.parse(latestRaw);
      return latest;
    } catch (error) {
      return null;
    }
  }

  return null;
}

function renderGeneratedReport(data) {
  const start = new Date(data.startISO);
  const end = new Date(data.endISO);

  document.getElementById("meetingTitle").textContent =
    data.title || data.meetingTitle || "회의";
  document.getElementById("meetingDate").textContent = formatKoreanDate(end);
  document.getElementById("meetingTime").textContent = `${formatTime(
    start,
  )} - ${formatTime(end)}`;
  document.getElementById("meetingDuration").textContent = formatDuration(
    start,
    end,
    data.durationMinutes,
  );
  document.getElementById("participants").textContent =
    data.participants.length + "명";
  document.getElementById("location").textContent = data.location || "온라인";

  const summaryListEl = document.getElementById("summaryList");
  const decisionListEl = document.getElementById("decisionList");
  const nextMeetingEl = document.getElementById("nextMeeting");
  const participantsListEl = document.getElementById("participantsList");
  const actionItemsEl = document.getElementById("actionItems");

  if (summaryListEl && data.summary?.topics) {
    summaryListEl.innerHTML = data.summary.topics
      .map((topic) => `<li>${topic}</li>`)
      .join("");
  }

  if (decisionListEl && data.summary?.decisions) {
    decisionListEl.innerHTML = data.summary.decisions
      .map(
        (decision) => `
          <div class="decision-item">
            <span class="decision-icon">✓</span>
            <p>${decision}</p>
          </div>
        `,
      )
      .join("");
  }

  if (nextMeetingEl && data.summary?.nextMeeting) {
    nextMeetingEl.textContent = data.summary.nextMeeting;
  }

  if (participantsListEl && data.participants) {
    participantsListEl.innerHTML = data.participants
      .map(
        (participant) => `
          <div class="participant-item">
            <span class="participant-name">${participant.name}</span>
            <span class="participant-role">${participant.role}</span>
            <span class="participant-status">${participant.status}</span>
          </div>
        `,
      )
      .join("");
  }

  if (actionItemsEl && data.actionItems) {
    actionItemsEl.innerHTML = data.actionItems
      .map(
        (item) => `
          <div class="action-item">
            <div class="action-header">
              <span class="action-id">#${item.id}</span>
              <span class="action-status pending">${item.status}</span>
            </div>
            <p class="action-task">${item.task}</p>
            <p class="action-owner">담당자: ${item.owner}</p>
            <p class="action-deadline">기한: ${item.deadline}</p>
          </div>
        `,
      )
      .join("");
  }

  document.getElementById("generatedDate").textContent =
    formatKoreanDateTime(end);
}

// 생성 날짜 설정
function setGeneratedDate() {
  const today = new Date();
  document.getElementById("generatedDate").textContent =
    formatKoreanDateTime(today);
}

function formatKoreanDate(date) {
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatKoreanDateTime(date) {
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(date) {
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDuration(start, end, fallbackMinutes = 0) {
  const diffMinutes = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / 60000) || fallbackMinutes,
  );
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  if (hours > 0 && minutes > 0) {
    return `${hours}시간 ${minutes}분`;
  }
  if (hours > 0) {
    return `${hours}시간`;
  }
  return `${minutes}분`;
}

// 버튼 이벤트
function initButtons() {
  // 돌아가기
  document.getElementById("backBtn").addEventListener("click", () => {
    window.history.back();
  });

  // 인쇄
  document.getElementById("printBtn").addEventListener("click", () => {
    window.print();
  });

  // PDF 다운로드
  document.getElementById("downloadBtn").addEventListener("click", () => {
    downloadPDF();
  });
}

// PDF 다운로드 함수
function downloadPDF() {
  const reportTitle = document.querySelector("h1").textContent;
  const meetingTitle = document.getElementById("meetingTitle").textContent;

  // 실제 PDF 다운로드는 백엔드에서 처리하거나
  // html2pdf 같은 라이브러리를 사용합니다
  alert(`"${meetingTitle}" 보고서를 PDF로 다운로드합니다.`);

  // html2pdf 라이브러리가 있다면 아래 코드를 사용할 수 있습니다:
  // const element = document.getElementById('reportContent');
  // const opt = {
  //     margin: 10,
  //     filename: `보고서_${meetingTitle}.pdf`,
  //     image: { type: 'jpeg', quality: 0.98 },
  //     html2canvas: { scale: 2 },
  //     jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
  // };
  // html2pdf().set(opt).from(element).save();
}

// 혹은 브라우저의 기본 인쇄 기능으로 PDF 저장
// 사용자가 Ctrl+P 또는 인쇄 버튼을 누르면 PDF로 저장할 수 있습니다.
