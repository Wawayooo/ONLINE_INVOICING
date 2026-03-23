const text = "Bound By Truth & Guarded Flame, No Hand May Alter, For All Is Sealed In Steadfast Security.";
const typingElement = document.getElementById("typing");
let index = 0;

function typeEffect() {
  if (index < text.length) {
    typingElement.textContent += text.charAt(index);
    index++;
    setTimeout(typeEffect, 80);
  } else {
    setTimeout(() => {
      typingElement.textContent = "";
      index = 0;
      typeEffect();
    }, 3000);
  }
}

typeEffect();

function showProofTransaction() {
  showLoadingScreen(() => {
    document.getElementById('workflowSection').style.display = 'none';
    const proof = document.getElementById('proofContainer');
    proof.style.display = 'block';
    setTimeout(() => proof.classList.add('show'), 50);
  });
}
function showProofTransaction() {
  showLoadingScreen(() => {
    document.getElementById('workflowSection').style.display = 'none';
    const proof = document.getElementById('proofContainer');
    proof.style.display = 'block';
    setTimeout(() => proof.classList.add('show'), 50);
  });
}

