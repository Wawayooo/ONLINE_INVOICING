
// Show Proof with loading screen
function showProofTransaction() {
  showLoadingScreen(() => {
    document.getElementById('workflowSection').style.display = 'none';
    const proof = document.getElementById('proofContainer');
    proof.style.display = 'block';
    setTimeout(() => proof.classList.add('show'), 50);
  });
}

// Show Proof with loading screen
function showProofTransaction() {
  showLoadingScreen(() => {
    document.getElementById('workflowSection').style.display = 'none';
    const proof = document.getElementById('proofContainer');
    proof.style.display = 'block';
    setTimeout(() => proof.classList.add('show'), 50);
  });
}
