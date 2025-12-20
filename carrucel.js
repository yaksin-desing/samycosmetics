const items = document.querySelectorAll('.item');
const total = items.length;
let index = 0;

// Parámetros del círculo acostado
const radiusX = 100;
const radiusZ = 200;

function updateCarousel() {
  items.forEach((item, i) => {
    const offset = ((i - index) + total) % total;

    // limpiar estados
    item.classList.remove(
      'hidden',
      'is-center',
      'blur-full',
      'blur-left',
      'blur-right'
    );

    // visibles
    if (
      offset !== 0 &&
      offset !== 1 &&
      offset !== 2 &&
      offset !== total - 1 &&
      offset !== total - 2
    ) {
      item.classList.add('hidden');


  // 👇 CLAVE: céntralo para que no afecte el alto
  item.style.transform = `
    translate(-50%, -50%)
    translateY(-15px)
    translateX(0px)
    translateY(0px)
    translateZ(0px)
    scale(0.5)
    z-index: -1000
  `;
      return;
    }

    let x = 0;
    let z = 0;
    let scale = 1;
    let y = 0;

    // ===== CENTRO =====
    if (offset === 0) {
      scale = 0.8;
      y = -0;
      item.classList.add('is-center');
    }

    // ===== DERECHA =====
    if (offset === 1) {
      x = radiusX;
      z = -radiusZ;
      scale = 0.7;
      item.classList.add('blur-right');
    }

    if (offset === 2) {
      x = radiusX * 2;
      z = -radiusZ * 1.5;
      scale = 0.5;
      item.classList.add('blur-full');
    }

    // ===== IZQUIERDA =====
    if (offset === total - 1) {
      x = -radiusX;
      z = -radiusZ;
      scale = 0.7;
      item.classList.add('blur-left');
    }

    if (offset === total - 2) {
      x = -radiusX * 2;
      z = -radiusZ * 1.5;
      scale = 0.5;
      item.classList.add('blur-full');
    }

    item.style.transform = `
      translate(-50%, -50%)
      translateX(${x}px)
      translateY(${y}px)
      translateZ(${z}px)
      scale(${scale})
    `;
  });
}



// ==================
// BOTONES
// ==================
document.getElementById('next').addEventListener('click', () => {
  index = (index + 1) % total;
  updateCarousel();
});

document.getElementById('prev').addEventListener('click', () => {
  index = (index - 1 + total) % total;
  updateCarousel();
});

// ==================
// SWIPE ANDROID / MOBILE
// ==================
let startX = 0;
let currentX = 0;
let dragging = false;
const threshold = 40;

const carousel = document.querySelector('.carousel');

carousel.addEventListener('touchstart', (e) => {
  startX = e.touches[0].clientX;
  dragging = true;
});

carousel.addEventListener('touchmove', (e) => {
  if (!dragging) return;
  currentX = e.touches[0].clientX;
});

carousel.addEventListener('touchend', () => {
  if (!dragging) return;

  const diff = startX - currentX;

  if (Math.abs(diff) > threshold) {
    if (diff > 0) {
      // swipe izquierda → siguiente
      index = (index + 1) % total;
    } else {
      // swipe derecha → anterior
      index = (index - 1 + total) % total;
    }
    updateCarousel();
  }

  dragging = false;
});

// ==================
// INIT
// ==================
updateCarousel();
