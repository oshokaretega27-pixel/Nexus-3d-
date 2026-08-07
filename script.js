/**
 * NEXUS - UI/UX Pro Max Engine
 * Modular architecture for maintainability and performance
 */

// ============================================================
// CONFIGURATION
// ============================================================
const CONFIG = Object.freeze({
    particleCount: 5000,
    colors: { primary: 0xa855f7, secondary: 0x3b82f6, pink: 0xec4899, bg: 0x02000a },
    text: 'NEXUS',
    fontSize: 280,
    starSize: 0.07,
    lerpFactor: 0.05,
    tiltMaxDeg: 8,
    magneticStrength: 0.3
});

// ============================================================
// STATE MANAGEMENT
// ============================================================
const state = {
    mouse: { x: 0, y: 0, targetX: 0, targetY: 0 },
    windowHalf: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    morphProgress: 1, // 1 = text formed, 0 = scattered
    positionsRandom: [],
    positionsText: [],
    particles: null,
    isMobile: window.matchMedia('(max-width: 768px)').matches
};

// ============================================================
// THREE.JS MODULE
// ============================================================
const StarField = (() => {
    let scene, camera, renderer;

    function init() {
        if (state.isMobile) return; // Skip heavy 3D on mobile

        const container = document.getElementById('canvas-container');
        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(CONFIG.colors.bg, 0.015);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 10;

        renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true, 
            powerPreference: 'high-performance' 
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(renderer.domElement);

        generateParticles();
        animate();
    }

    function generateParticles() {
        // Offscreen canvas text sampling
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 1200;
        canvas.height = 600;

        ctx.fillStyle = 'white';
        ctx.font = `800 ${CONFIG.fontSize}px Syne, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(CONFIG.text, canvas.width / 2, canvas.height / 2);

        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const textPoints = [];
        const step = 3;

        for (let y = 0; y < canvas.height; y += step) {
            for (let x = 0; x < canvas.width; x += step) {
                if (pixels[(y * canvas.width + x) * 4 + 3] > 128) {
                    textPoints.push(
                        (x - canvas.width / 2) * 0.014,
                        -(y - canvas.height / 2) * 0.014,
                        (Math.random() - 0.5) * 1.5
                    );
                }
            }
        }

        const count = textPoints.length / 3;
        const geometry = new THREE.BufferGeometry();
        const posArray = new Float32Array(count * 3);
        const colorsArray = new Float32Array(count * 3);

        const c1 = new THREE.Color(CONFIG.colors.primary);
        const c2 = new THREE.Color(CONFIG.colors.secondary);
        const c3 = new THREE.Color(CONFIG.colors.pink);

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;

            // Store text positions
            state.positionsText.push(textPoints[i3], textPoints[i3 + 1], textPoints[i3 + 2]);

            // Generate random universe positions
            state.positionsRandom.push(
                (Math.random() - 0.5) * 40,
                (Math.random() - 0.5) * 25,
                (Math.random() - 0.5) * 20 - 5
            );

            // Initialize at random positions
            posArray[i3] = state.positionsRandom[i3];
            posArray[i3 + 1] = state.positionsRandom[i3 + 1];
            posArray[i3 + 2] = state.positionsRandom[i3 + 2];

            // Tri-color gradient
            const t = Math.random();
            const color = t < 0.5
                ? c1.clone().lerp(c2, t * 2)
                : c2.clone().lerp(c3, (t - 0.5) * 2);

            colorsArray[i3] = color.r;
            colorsArray[i3 + 1] = color.g;
            colorsArray[i3 + 2] = color.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));

        const material = new THREE.PointsMaterial({
            size: CONFIG.starSize,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true
        });

        state.particles = new THREE.Points(geometry, material);
        scene.add(state.particles);
    }

    function updatePositions() {
        if (!state.particles) return;
        const arr = state.particles.geometry.attributes.position.array;
        const p = state.morphProgress;

        for (let i = 0; i < arr.length; i++) {
            arr[i] = state.positionsRandom[i] * (1 - p) + state.positionsText[i] * p;
        }
        state.particles.geometry.attributes.position.needsUpdate = true;
    }

    function animate() {
        requestAnimationFrame(animate);

        // Smooth mouse interpolation
        state.mouse.x += (state.mouse.targetX - state.mouse.x) * CONFIG.lerpFactor;
        state.mouse.y += (state.mouse.targetY - state.mouse.y) * CONFIG.lerpFactor;

        if (state.particles) {
            state.particles.rotation.y = state.mouse.x * 0.0003;
            state.particles.rotation.x = state.mouse.y * 0.0003;

            // Breathing pulse
            const time = Date.now() * 0.001;
            state.particles.material.size = CONFIG.starSize + Math.sin(time * 2) * 0.005;
        }

        renderer.render(scene, camera);
    }

    function resize() {
        if (!camera || !renderer) return;
        state.windowHalf.x = window.innerWidth / 2;
        state.windowHalf.y = window.innerHeight / 2;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    return { init, updatePositions, resize };
})();

// ============================================================
// INTERACTION MODULE
// ============================================================
const Interactions = (() => {
    const cursorDot = document.querySelector('.cursor-dot');
    const cursorRing = document.querySelector('.cursor-ring');

    function initCursor() {
        if (state.isMobile) return;

        document.addEventListener('mousemove', (e) => {
            state.mouse.targetX = e.clientX - state.windowHalf.x;
            state.mouse.targetY = e.clientY - state.windowHalf.y;

            gsap.to(cursorDot, { duration: 0.1, x: e.clientX, y: e.clientY });
            gsap.to(cursorRing, { duration: 0.25, x: e.clientX, y: e.clientY });

            updateCardSpotlight(e);
        });

        // Magnetic triggers
        document.querySelectorAll('.magnetic-trigger').forEach(el => {
            el.addEventListener('mouseenter', () => document.body.classList.add('cursor-magnetic'));
            el.addEventListener('mouseleave', () => {
                document.body.classList.remove('cursor-magnetic');
                gsap.to(el, { duration: 0.5, x: 0, y: 0, ease: 'elastic.out(1, 0.3)' });
            });
            el.addEventListener('mousemove', (e) => {
                const rect = el.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                gsap.to(el, { 
                    duration: 0.3, 
                    x: x * CONFIG.magneticStrength, 
                    y: y * CONFIG.magneticStrength, 
                    ease: 'power2.out' 
                });
            });
        });
    }

    function initTiltCards() {
        if (state.isMobile) return;

        document.querySelectorAll('.tilt-card-wrapper').forEach(wrapper => {
            const card = wrapper.querySelector('.glass-card');

            wrapper.addEventListener('mousemove', (e) => {
                const rect = wrapper.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                const rotateX = ((y - centerY) / centerY) * -CONFIG.tiltMaxDeg;
                const rotateY = ((x - centerX) / centerX) * CONFIG.tiltMaxDeg;

                gsap.to(card, {
                    duration: 0.4,
                    rotateX,
                    rotateY,
                    transformPerspective: 1000,
                    ease: 'power2.out'
                });
            });

            wrapper.addEventListener('mouseleave', () => {
                gsap.to(card, { 
                    duration: 0.8, 
                    rotateX: 0, 
                    rotateY: 0, 
                    ease: 'elastic.out(1, 0.5)' 
                });
            });
        });
    }

    function updateCardSpotlight(e) {
        document.querySelectorAll('.glass-card').forEach(card => {
            const rect = card.getBoundingClientRect();
            card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
            card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
        });
    }

    function initFAQ() {
        document.querySelectorAll('.faq-item').forEach(item => {
            const btn = item.querySelector('.faq-question');
            btn.addEventListener('click', () => {
                const isActive = item.classList.contains('active');
                
                // Close all others
                document.querySelectorAll('.faq-item').forEach(i => {
                    i.classList.remove('active');
                    i.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
                });

                // Toggle current
                if (!isActive) {
                    item.classList.add('active');
                    btn.setAttribute('aria-expanded', 'true');
                }
            });
        });
    }

    function initNavScroll() {
        window.addEventListener('scroll', () => {
            const nav = document.querySelector('nav');
            nav.style.background = window.scrollY > 100 
                ? 'rgba(10, 5, 20, 0.9)' 
                : 'rgba(10, 5, 20, 0.6)';
        }, { passive: true });
    }

    return { initCursor, initTiltCards, initFAQ, initNavScroll };
})();

// ============================================================
// ANIMATION ORCHESTRATOR
// ============================================================
const Orchestrator = (() => {
    function init() {
        gsap.registerPlugin(ScrollTrigger);

        // Loader sequence
        const counter = document.querySelector('.loader-counter');
        const line = document.querySelector('.loader-line');

        const tl = gsap.timeline();

        tl.to({ val: 0 }, {
            val: 100,
            duration: 2,
            ease: 'power2.inOut',
            onUpdate: function () {
                counter.textContent = Math.floor(this.targets()[0].val) + '%';
            }
        })
        .to(line, { height: '100px', duration: 0.5, ease: 'power2.out' }, '-=0.5')
        .to('#loader', { y: '-100%', duration: 1.2, ease: 'expo.inOut', delay: 0.3 })
        .add(() => document.querySelector('nav').classList.add('visible'), '-=0.8')
        .from('.reveal-anim', { 
            y: 60, opacity: 0, duration: 1.2, stagger: 0.15, ease: 'power3.out' 
        }, '-=0.8');

        // Star morph: Random → Text after loader
        gsap.to(state, {
            morphProgress: 1,
            duration: 3,
            delay: 2.5,
            ease: 'power2.inOut',
            onUpdate: StarField.updatePositions
        });

        // Scroll morph: Text → Scatter
        gsap.to(state, {
            morphProgress: 0,
            scrollTrigger: {
                trigger: '#features',
                start: 'top 80%',
                end: 'top 20%',
                scrub: 1.5
            },
            onUpdate: StarField.updatePositions
        });

        // Section reveals
        document.querySelectorAll('section').forEach(section => {
            gsap.from(section.querySelectorAll('.reveal-anim'), {
                scrollTrigger: { 
                    trigger: section, 
                    start: 'top 80%', 
                    toggleActions: 'play none none reverse' 
                },
                y: 60, opacity: 0, duration: 1, stagger: 0.1, ease: 'power3.out'
            });
        });
    }

    return { init };
})();

// ============================================================
// INITIALIZATION
// ============================================================
window.addEventListener('load', () => {
    StarField.init();
    Interactions.initCursor();
    Interactions.initTiltCards();
    Interactions.initFAQ();
    Interactions.initNavScroll();
    Orchestrator.init();
});

window.addEventListener('resize', () => {
    state.windowHalf.x = window.innerWidth / 2;
    state.windowHalf.y = window.innerHeight / 2;
    state.isMobile = window.matchMedia('(max-width: 768px)').matches;
    StarField.resize();
}, { passive: true });
