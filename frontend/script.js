const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const rememberMe = document.getElementById("rememberMe");

// 로컬 스토리지에서 저장된 이메일 불러오기
document.addEventListener("DOMContentLoaded", () => {
  const savedEmail = localStorage.getItem("userEmail");
  const savedRemember = localStorage.getItem("rememberMe") === "true";

  if (savedEmail && savedRemember) {
    emailInput.value = savedEmail;
    rememberMe.checked = true;
  }
});

// 로그인 폼 제출
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  // 입력 값 검증
  if (!email || !password) {
    showError("이메일과 비밀번호를 입력해주세요.");
    return;
  }

  if (!isValidEmail(email)) {
    showError("유효한 이메일을 입력해주세요.");
    return;
  }

  // 로그인 버튼 비활성화
  const loginButton = loginForm.querySelector(".login-button");
  loginButton.disabled = true;
  loginButton.textContent = "로그인 중...";

  try {
    // 여기에 실제 API 호출을 추가하세요
    // const response = await fetch('/api/login', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ email, password })
    // });

    // 임시 데모 로직
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 로그인 성공 시
    if (rememberMe.checked) {
      localStorage.setItem("userEmail", email);
      localStorage.setItem("rememberMe", "true");
    } else {
      localStorage.removeItem("userEmail");
      localStorage.setItem("rememberMe", "false");
    }

    // 자연스럽게 대시보드로 이동
    window.location.href = "dashboard.html";
  } catch (error) {
    showError("로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
    console.error("Login error:", error);
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "로그인";
  }
});

// 이메일 유효성 검사
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// 에러 메시지 표시
function showError(message) {
  alert(message); // 실제로는 토스트 메시지 등을 사용
}

// 성공 메시지 표시
function showSuccess(message) {
  alert(message); // 실제로는 토스트 메시지 등을 사용
}

// Enter 키로 로그인 submit
emailInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    passwordInput.focus();
  }
});

passwordInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    loginForm.dispatchEvent(new Event("submit"));
  }
});
