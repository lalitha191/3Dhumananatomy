/* Anatomy Atlas - 3D explorer (three.js r147, classic script build) */
(function () {
  'use strict';

  var D = window.BODY_DATA;
  var SYS = D.systems;
  var ORGANS = D.organs;

  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  var stage = $('#stage');
  var detailEl = $('#detail');
  var listEl = $('#organList');
  var chipsEl = $('#chips');
  var searchEl = $('#search');

  var organs = {};            // id -> { def, group, mats, meshes }
  var selected = null;
  var hovered = null;
  var isolate = null;         // system id or null
  var query = '';
  var has3D = !!(window.THREE && THREE.OrbitControls);

  /* =====================================================
     3D SCENE
     ===================================================== */
  var scene, camera, renderer, controls, clock, root, tween = null;
  var HOME_POS, HOME_TARGET;
  var skinMat, skinGroup;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function V(a) { return new THREE.Vector3(a[0], a[1], a[2]); }

  function mat(color, base, rough) {
    var m = new THREE.MeshStandardMaterial({
      color: color, roughness: rough == null ? 0.55 : rough, metalness: 0.0,
      emissive: 0xffa94d, emissiveIntensity: 0
    });
    m.userData.base = base == null ? 1 : base;
    m.opacity = m.userData.base;
    m.transparent = m.opacity < 1;
    return m;
  }

  function ell(rx, ry, rz, m, pos, rot) {
    var mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), m);
    mesh.scale.set(rx, ry, rz);
    mesh.position.set(pos[0], pos[1], pos[2]);
    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
    return mesh;
  }

  function tube(points, r, m, seg) {
    var curve = new THREE.CatmullRomCurve3(points.map(V));
    return new THREE.Mesh(new THREE.TubeGeometry(curve, seg || 64, r, 10, false), m);
  }

  function between(a, b, geo) {
    var A = V(a), B = V(b);
    var mesh = new THREE.Mesh(geo);
    mesh.position.copy(A).add(B).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    return mesh;
  }

  function bone(a, b, r, m) {
    var len = V(a).distanceTo(V(b));
    var mesh = between(a, b, new THREE.CylinderGeometry(r, r * 0.88, len, 14));
    mesh.material = m;
    return mesh;
  }

  function knob(p, r, m) {
    var s = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), m);
    s.position.set(p[0], p[1], p[2]);
    return s;
  }

  function mirror(fn) { return [fn(1), fn(-1)]; }

  function register(id, parts) {
    var def = ORGANS.filter(function (o) { return o.id === id; })[0];
    var group = new THREE.Group();
    parts.forEach(function (p) { group.add(p); });
    var mats = [], meshes = [];
    group.traverse(function (o) {
      if (o.isMesh) {
        o.userData.organId = id;
        meshes.push(o);
        if (mats.indexOf(o.material) < 0) mats.push(o.material);
      }
    });
    root.add(group);
    organs[id] = { def: def, group: group, mats: mats, meshes: meshes };
  }

  function buildOrgans() {
    var m, m2, parts;

    /* ---- nervous ---- */
    m = mat(0xe9a5b8, 1, 0.85); m2 = mat(0xd98ca5, 1, 0.85);
    register('brain', [
      ell(0.115, 0.17, 0.25, m, [-0.115, 1.56, 0.0]),
      ell(0.115, 0.17, 0.25, m, [0.115, 1.56, 0.0]),
      ell(0.13, 0.075, 0.09, m2, [0, 1.42, -0.17]),
      tube([[0, 1.42, -0.05], [0, 1.32, -0.07], [0, 1.24, -0.09]], 0.035, m2, 12)
    ]);
    m = mat(0xf3e3a6, 1, 0.5);
    register('spinal-cord', [tube([[0, 1.26, -0.1], [0, 0.8, -0.115], [0, 0.2, -0.1], [0, -0.45, -0.1]], 0.02, m, 60)]);
    m = mat(0xf2d36b, 1, 0.5);
    parts = [];
    mirror(function (s) {
      parts.push(tube([[0, 0.85, -0.1], [s * 0.25, 0.86, -0.06], [s * 0.46, 0.55, -0.03], [s * 0.52, 0.3, -0.02], [s * 0.6, -0.2, 0]], 0.012, m, 40));
      parts.push(tube([[0, -0.5, -0.1], [s * 0.1, -0.6, -0.07], [s * 0.15, -1.1, -0.04], [s * 0.17, -1.7, 0]], 0.014, m, 40));
    });
    register('nerves', parts);

    /* ---- endocrine ---- */
    m = mat(0x9d78d8, 1, 0.6);
    register('thyroid', [
      ell(0.032, 0.05, 0.026, m, [-0.04, 1.09, 0.092], [0, 0, 0.2]),
      ell(0.032, 0.05, 0.026, m, [0.04, 1.09, 0.092], [0, 0, -0.2]),
      ell(0.03, 0.014, 0.02, m, [0, 1.06, 0.095])
    ]);
    m = mat(0xe3c04f, 1, 0.6);
    register('adrenal', mirror(function (s) {
      return ell(0.038, 0.022, 0.03, m, [s * 0.13, 0.2, -0.07], [0, 0, s * 0.3]);
    }));

    /* ---- circulatory ---- */
    m = mat(0xb5262e, 1, 0.45); m2 = mat(0xd2434a, 1, 0.45);
    register('heart', [
      ell(0.1, 0.125, 0.09, m, [0.06, 0.55, 0.1], [0, 0, -0.45]),
      ell(0.055, 0.05, 0.05, m2, [-0.01, 0.65, 0.09]),
      ell(0.04, 0.06, 0.04, m2, [0.0, 0.7, 0.09])
    ]);
    var artery = mat(0xd9302f, 1, 0.4), vein = mat(0x3a62b8, 1, 0.4);
    parts = [
      tube([[0.0, 0.66, 0.08], [0.02, 0.76, 0.07], [-0.05, 0.8, 0.02], [-0.1, 0.72, -0.03], [-0.09, 0.4, -0.06], [-0.04, 0.0, -0.06], [0, -0.4, -0.05]], 0.024, artery, 70),
      tube([[-0.035, 0.64, 0.06], [-0.06, 0.3, -0.01], [-0.045, -0.1, -0.04], [-0.02, -0.4, -0.04]], 0.026, vein, 50)
    ];
    mirror(function (s) {
      parts.push(tube([[0, -0.4, -0.05], [s * 0.1, -0.58, 0.0], [s * 0.17, -1.1, 0.03], [s * 0.18, -1.72, 0.03]], 0.017, artery, 50));
      parts.push(tube([[0, -0.4, -0.03], [s * 0.06, -0.58, 0.04], [s * 0.2, -1.1, 0.05], [s * 0.2, -1.72, 0.05]], 0.016, vein, 50));
      parts.push(tube([[s * 0.02, 0.78, 0.04], [s * 0.05, 1.0, 0.07], [s * 0.065, 1.34, 0.07]], 0.014, artery, 30));
      parts.push(tube([[s * 0.0, 0.8, 0.04], [s * 0.38, 0.86, 0.02], [s * 0.5, 0.4, 0.02], [s * 0.58, -0.2, 0.02]], 0.011, artery, 40));
    });
    register('vessels', parts);
    m = mat(0x7a2d4c, 1, 0.6);
    register('spleen', [ell(0.05, 0.085, 0.04, m, [0.27, 0.22, -0.06], [0, 0, 0.2])]);

    /* ---- respiratory ---- */
    m = mat(0xe58aa0, 1, 0.75);
    register('lungs', [
      ell(0.15, 0.3, 0.12, m, [-0.2, 0.63, 0.0], [0, 0, 0.07]),
      ell(0.13, 0.3, 0.12, m, [0.2, 0.63, 0.0], [0, 0, -0.07])
    ]);
    m = mat(0xcfe3ea, 1, 0.5);
    register('trachea', [
      tube([[0, 1.2, 0.05], [0, 0.8, 0.05]], 0.034, m, 12),
      tube([[0, 0.8, 0.05], [-0.07, 0.72, 0.045], [-0.13, 0.62, 0.03]], 0.022, m, 12),
      tube([[0, 0.8, 0.05], [0.07, 0.72, 0.045], [0.12, 0.62, 0.03]], 0.022, m, 12)
    ]);

    /* ---- digestive ---- */
    m = mat(0xe89a8c, 1, 0.5);
    register('esophagus', [tube([[0, 1.14, -0.02], [0, 0.9, -0.02], [0, 0.6, -0.02], [0.02, 0.4, 0.03], [0.06, 0.3, 0.08]], 0.019, m, 40)]);
    m = mat(0xe58a73, 1, 0.55);
    register('stomach', [
      ell(0.13, 0.09, 0.09, m, [0.13, 0.22, 0.1], [0, 0, -0.6]),
      ell(0.075, 0.065, 0.075, m, [0.02, 0.15, 0.1])
    ]);
    m = mat(0x7b3a28, 1, 0.55);
    register('liver', [
      ell(0.2, 0.1, 0.12, m, [-0.12, 0.3, 0.07], [0, 0, 0.15]),
      ell(0.12, 0.08, 0.1, m, [0.07, 0.27, 0.08])
    ]);
    m = mat(0x5a8c3c, 1, 0.5);
    register('gallbladder', [ell(0.03, 0.045, 0.03, m, [-0.1, 0.18, 0.15])]);
    m = mat(0xe8c27a, 1, 0.6);
    register('pancreas', [ell(0.17, 0.034, 0.04, m, [0.02, 0.11, 0.04], [0, 0, 0.12])]);

    // small intestine: serpentine coil
    var pts = [], r, k, x, dir;
    for (r = 0; r < 8; r++) {
      dir = (r % 2 === 0) ? 1 : -1;
      for (k = 0; k <= 4; k++) {
        x = dir * (-0.15 + 0.075 * k);
        pts.push([x, -0.02 - r * 0.045 + (k % 2) * 0.012, 0.075 + 0.02 * Math.sin(k + r)]);
      }
    }
    m = mat(0xeaa98d, 1, 0.5);
    register('small-intestine', [tube(pts, 0.021, m, 520)]);

    m = mat(0xc98d68, 1, 0.55);
    register('large-intestine', [tube([
      [-0.2, -0.36, 0.07], [-0.21, -0.15, 0.07], [-0.2, 0.03, 0.06], [-0.1, 0.08, 0.11], [0.1, 0.08, 0.11],
      [0.21, 0.02, 0.07], [0.21, -0.2, 0.06], [0.16, -0.36, 0.05], [0.06, -0.4, 0.04], [0.0, -0.4, 0.02], [0.0, -0.55, -0.02]
    ], 0.031, m, 160)]);

    /* ---- urinary ---- */
    m = mat(0xa33f3a, 1, 0.5);
    register('kidneys', mirror(function (s) {
      return ell(0.05, 0.09, 0.04, m, [s * 0.14, 0.08, -0.08], [0, 0, s * 0.2]);
    }));
    m = mat(0xe3d28e, 1, 0.5);
    register('ureters', mirror(function (s) {
      return tube([[s * 0.13, 0.0, -0.07], [s * 0.1, -0.2, -0.05], [s * 0.05, -0.4, 0.03]], 0.008, m, 24);
    }));
    m = mat(0xe3b3a0, 1, 0.6);
    register('bladder', [ell(0.07, 0.07, 0.07, m, [0, -0.46, 0.05])]);

    /* ---- skeletal ---- */
    var bn = mat(0xe9e2cf, 0.9, 0.7);
    var skullM = mat(0xece5d2, 0.3, 0.7);
    register('skull', [
      ell(0.285, 0.31, 0.32, skullM, [0, 1.56, 0]),
      ell(0.17, 0.09, 0.14, skullM, [0, 1.3, 0.12])
    ]);

    parts = [];
    var i, y;
    for (i = 0; i < 24; i++) {
      y = 1.2 - i * (1.62 / 23);
      var v = new THREE.Mesh(new THREE.CylinderGeometry(0.05 + i * 0.0012, 0.05 + i * 0.0012, 0.045, 16), bn);
      v.position.set(0, y, -0.15 - 0.02 * Math.sin(i / 23 * Math.PI * 2));
      parts.push(v);
    }
    var sac = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.2, 14), bn);
    sac.position.set(0, -0.58, -0.17);
    sac.rotation.x = Math.PI;
    parts.push(sac);
    register('spine', parts);

    // rib cage: 12 pairs + sternum + clavicles
    var ribM = mat(0xe9e2cf, 0.78, 0.7);
    parts = [];
    var sterno = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.022), ribM);
    sterno.position.set(0, 0.64, 0.175);
    parts.push(sterno);
    for (i = 0; i < 12; i++) {
      var by = 0.88 - i * 0.043;
      var rx = i <= 6 ? 0.17 + 0.17 * Math.sin(i / 6 * Math.PI / 2) : 0.34 - (i - 6) * 0.018;
      var rz = 0.16;
      var floating = i >= 10;
      mirror(function (s) {
        var pp = [], n = 12, t, phi;
        for (t = 0; t <= n; t++) {
          phi = 0.12 + (t / n) * (Math.PI * (floating ? 0.62 : 0.93) - 0.12);
          pp.push([s * rx * Math.sin(phi), by - 0.07 * (t / n), 0.01 - rz * Math.cos(phi)]);
        }
        parts.push(tube(pp, 0.0085, ribM, 28));
      });
    }
    mirror(function (s) {
      parts.push(tube([[s * 0.035, 0.9, 0.17], [s * 0.2, 0.94, 0.12], [s * 0.4, 0.92, 0.01]], 0.011, ribM, 20));
    });
    register('ribcage', parts);

    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 12, 32), bn);
    ring.rotation.x = Math.PI / 2; ring.scale.set(1.35, 1, 0.9); ring.position.set(0, -0.66, -0.02);
    register('pelvis', [
      ring,
      ell(0.14, 0.15, 0.04, bn, [-0.19, -0.5, -0.04], [0, 0.55, 0.25]),
      ell(0.14, 0.15, 0.04, bn, [0.19, -0.5, -0.04], [0, -0.55, -0.25])
    ]);

    parts = [];
    mirror(function (s) {
      parts.push(bone([s * 0.46, 0.88, 0], [s * 0.52, 0.34, 0], 0.022, bn));
      parts.push(bone([s * 0.52, 0.32, 0], [s * 0.6, -0.22, 0], 0.017, bn));
      parts.push(knob([s * 0.46, 0.88, 0], 0.04, bn));
      parts.push(knob([s * 0.52, 0.33, 0], 0.03, bn));
      parts.push(ell(0.04, 0.07, 0.015, bn, [s * 0.62, -0.3, 0]));
    });
    register('arm-bones', parts);

    parts = [];
    mirror(function (s) {
      parts.push(bone([s * 0.15, -0.58, 0], [s * 0.19, -1.15, 0.01], 0.032, bn));
      parts.push(bone([s * 0.19, -1.18, 0.01], [s * 0.18, -1.76, 0], 0.024, bn));
      parts.push(knob([s * 0.15, -0.58, 0], 0.052, bn));
      parts.push(knob([s * 0.19, -1.16, 0.01], 0.045, bn));
      parts.push(ell(0.05, 0.03, 0.11, bn, [s * 0.18, -1.84, 0.06]));
    });
    register('leg-bones', parts);
  }

  function capsule(a, b, r) {
    var len = Math.max(0.001, V(a).distanceTo(V(b)) - 2 * r);
    var mesh = between(a, b, new THREE.CapsuleGeometry(r, len, 6, 20));
    mesh.material = skinMat;
    return mesh;
  }

  function buildSkin() {
    skinMat = new THREE.MeshPhysicalMaterial({
      color: 0xa7d4e8, transparent: true, opacity: 0.14, roughness: 0.25,
      depthWrite: false
    });
    skinGroup = new THREE.Group();
    var parts = [
      ell(0.34, 0.4, 0.37, skinMat, [0, 1.55, 0]),
      new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.34, 24), skinMat),
      ell(0.44, 0.85, 0.26, skinMat, [0, 0.12, 0]),
      ell(0.36, 0.22, 0.25, skinMat, [0, -0.55, 0]),
      capsule([-0.45, 0.88, 0], [0.45, 0.88, 0], 0.1)
    ];
    parts[1].position.set(0, 1.14, 0);
    mirror(function (s) {
      parts.push(capsule([s * 0.45, 0.88, 0], [s * 0.53, 0.32, 0], 0.085));
      parts.push(capsule([s * 0.53, 0.32, 0], [s * 0.6, -0.22, 0], 0.07));
      parts.push(ell(0.05, 0.09, 0.035, skinMat, [s * 0.62, -0.33, 0]));
      parts.push(capsule([s * 0.16, -0.6, 0], [s * 0.19, -1.15, 0], 0.13));
      parts.push(capsule([s * 0.19, -1.15, 0], [s * 0.18, -1.76, 0], 0.095));
      parts.push(ell(0.075, 0.05, 0.15, skinMat, [s * 0.18, -1.87, 0.06]));
    });
    parts.forEach(function (p) {
      p.material = skinMat;
      p.raycast = function () {};      // skin never blocks clicks
      skinGroup.add(p);
    });
    root.add(skinGroup);
  }

  function initScene() {
    scene = new THREE.Scene();
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    stage.appendChild(renderer.domElement);

    camera = new THREE.PerspectiveCamera(35, 1, 0.05, 60);
    HOME_POS = new THREE.Vector3(0, 0.1, 7.2);
    HOME_TARGET = new THREE.Vector3(0, 0, 0);
    camera.position.copy(HOME_POS);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.7;
    controls.maxDistance = 10;
    controls.autoRotateSpeed = 1.6;
    controls.target.copy(HOME_TARGET);
    controls.addEventListener('start', function () { tween = null; });

    scene.add(new THREE.HemisphereLight(0xffffff, 0x35586a, 0.95));
    var key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(2, 3, 4); scene.add(key);
    var rim = new THREE.DirectionalLight(0x9fd0ff, 0.55); rim.position.set(-3, 1, -3); scene.add(rim);

    root = new THREE.Group();
    scene.add(root);
    buildOrgans();
    buildSkin();

    // turntable
    var disc = new THREE.Mesh(new THREE.CircleGeometry(0.75, 64),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07 }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = -1.93; scene.add(disc);
    var rim2 = new THREE.Mesh(new THREE.RingGeometry(0.74, 0.76, 64),
      new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    rim2.rotation.x = -Math.PI / 2; rim2.position.y = -1.93; scene.add(rim2);

    clock = new THREE.Clock();
    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
    window.addEventListener('resize', resize);
    bindPointer();
    animate();
  }

  function resize() {
    if (!renderer) return;
    var w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole body in frame on narrow stages
    camera.fov = w / h < 0.8 ? 46 : 35;
    camera.updateProjectionMatrix();
  }

  /* ---------- camera moves ---------- */
  function flyTo(pos, target, dur) {
    if (reduceMotion) dur = 0.01;
    tween = { t: 0, dur: dur || 0.9, p0: camera.position.clone(), p1: pos, t0: controls.target.clone(), t1: target };
  }

  function focusOn(id) {
    var o = organs[id];
    if (!o) return;
    var box = new THREE.Box3().setFromObject(o.group);
    var c = box.getCenter(new THREE.Vector3());
    var size = box.getSize(new THREE.Vector3());
    var dist = Math.min(3.2, Math.max(1.1, Math.max(size.x, size.y) * 2.4 + 0.7));
    var dir = camera.position.clone().sub(controls.target).normalize();
    // organs on the back (spinal cord, kidneys, adrenals) are fine from any side; keep user's side
    flyTo(c.clone().add(dir.multiplyScalar(dist)), c, 0.9);
  }

  function zoomBy(f) {
    var off = camera.position.clone().sub(controls.target);
    var len = Math.min(controls.maxDistance, Math.max(controls.minDistance, off.length() * f));
    flyTo(controls.target.clone().add(off.normalize().multiplyScalar(len)), controls.target.clone(), 0.4);
  }

  function rotateBy(deg) {
    var off = camera.position.clone().sub(controls.target);
    off.applyAxisAngle(new THREE.Vector3(0, 1, 0), deg * Math.PI / 180);
    flyTo(controls.target.clone().add(off), controls.target.clone(), 0.6);
  }

  function resetView() { flyTo(HOME_POS.clone(), HOME_TARGET.clone(), 1.0); }

  /* ---------- picking ---------- */
  var ray, mouse, downXY = null, pickPending = false, lastMove = null;

  function pick(ev) {
    var rect = renderer.domElement.getBoundingClientRect();
    mouse.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    var meshes = [];
    Object.keys(organs).forEach(function (id) {
      if (organs[id].group.visible) meshes = meshes.concat(organs[id].meshes);
    });
    var hits = ray.intersectObjects(meshes, false);
    var first = null, i, id;
    for (i = 0; i < hits.length; i++) {
      id = hits[i].object.userData.organId;
      if (organs[id].def.system !== 'skeletal') return id;   // soft organs win over bones in front of them
      if (!first) first = id;
    }
    return first;
  }

  function bindPointer() {
    ray = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    var el = renderer.domElement, tip = $('#tip');

    el.addEventListener('pointerdown', function (e) {
      downXY = [e.clientX, e.clientY];
      var h = $('#hint'); if (h) h.classList.add('gone');
    });
    el.addEventListener('pointerup', function (e) {
      if (!downXY) return;
      var moved = Math.abs(e.clientX - downXY[0]) + Math.abs(e.clientY - downXY[1]);
      downXY = null;
      if (moved > 6 || e.button > 0) return;
      var id = pick(e);
      if (id) select(id, false); else select(null);
    });
    el.addEventListener('pointermove', function (e) {
      lastMove = e;
      if (e.buttons || pickPending) return;
      pickPending = true;
      requestAnimationFrame(function () {
        pickPending = false;
        var id = pick(lastMove);
        hovered = id;
        el.style.cursor = id ? 'pointer' : 'grab';
        if (id) {
          var r = stage.getBoundingClientRect();
          tip.textContent = organs[id].def.name;
          tip.style.left = (lastMove.clientX - r.left) + 'px';
          tip.style.top = (lastMove.clientY - r.top) + 'px';
          tip.hidden = false;
        } else {
          tip.hidden = true;
        }
      });
    });
    el.addEventListener('pointerleave', function () { hovered = null; tip.hidden = true; });
  }

  /* ---------- render loop ---------- */
  function matchSet() {
    if (!query) return null;
    var set = {};
    visibleDefs().forEach(function (o) { set[o.id] = true; });
    return set;
  }

  function applyOpacity() {
    var ms = matchSet();
    var anyMatch = ms && Object.keys(ms).length > 0;
    Object.keys(organs).forEach(function (id) {
      var o = organs[id];
      o.group.visible = !isolate || o.def.system === isolate;
      var dim = selected ? id !== selected : (anyMatch ? !ms[id] : false);
      o.mats.forEach(function (m) {
        var base = m.userData.base;
        var op = dim ? Math.min(base, 0.22) : base;
        var wasT = m.transparent;
        m.opacity = op;
        m.transparent = op < 1;
        m.depthWrite = op >= 0.5;
        if (wasT !== m.transparent) m.needsUpdate = true;
      });
    });
  }

  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);
    var t = clock.elapsedTime;

    if (tween) {
      tween.t += dt;
      var k = Math.min(1, tween.t / tween.dur);
      var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      camera.position.lerpVectors(tween.p0, tween.p1, e);
      controls.target.lerpVectors(tween.t0, tween.t1, e);
      if (k >= 1) tween = null;
    }
    controls.update();

    var ms = matchSet();
    Object.keys(organs).forEach(function (id) {
      var o = organs[id], g = 0;
      if (id === selected) g = 0.5 + 0.2 * Math.sin(t * 3.2);
      else if (id === hovered) g = 0.35;
      else if (!selected && ms && ms[id]) g = 0.25 + 0.12 * Math.sin(t * 3.2);
      o.mats.forEach(function (m) { m.emissiveIntensity = g; });
    });

    if (stage.clientWidth) renderer.render(scene, camera);
  }

  /* =====================================================
     UI: list, chips, detail
     ===================================================== */
  function visibleDefs() {
    var q = query.trim().toLowerCase();
    return ORGANS.filter(function (o) {
      if (isolate && o.system !== isolate) return false;
      if (!q) return true;
      var hay = (o.name + ' ' + SYS[o.system].label + ' ' + (o.keywords || '') + ' ' + o.function + ' ' + o.location).toLowerCase();
      return q.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
    });
  }

  function renderChips() {
    var html = '<button type="button" class="chip" data-sys="" aria-pressed="' + (!isolate) + '">All systems</button>';
    Object.keys(SYS).forEach(function (k) {
      html += '<button type="button" class="chip" data-sys="' + k + '" aria-pressed="' + (isolate === k) + '">' +
        '<i style="background:' + SYS[k].color + '"></i>' + esc(SYS[k].label.replace(' system', '')) + '</button>';
    });
    chipsEl.innerHTML = html;
  }

  function renderList() {
    var defs = visibleDefs();
    if (!defs.length) {
      listEl.innerHTML = '<p class="empty-list">No organ matches \u201c' + esc(query) + '\u201d. Try a body system such as \u201cdigestive\u201d, or a function such as \u201cfilter\u201d.</p>';
      return;
    }
    var html = '';
    Object.keys(SYS).forEach(function (k) {
      var inSys = defs.filter(function (o) { return o.system === k; });
      if (!inSys.length) return;
      html += '<h3 class="group-title"><i style="background:' + SYS[k].color + '"></i>' + esc(SYS[k].label) + '</h3>';
      inSys.forEach(function (o) {
        html += '<button type="button" class="organ-btn' + (o.id === selected ? ' on' : '') + '" data-id="' + o.id + '">' + esc(o.name) + '</button>';
      });
    });
    listEl.innerHTML = html;
  }

  function defOf(id) { return ORGANS.filter(function (o) { return o.id === id; })[0]; }

  function renderDetail() {
    if (!selected) {
      detailEl.innerHTML =
        '<h2>Pick an organ</h2>' +
        '<p class="lede">Click any organ in the model, or choose one from the list. You will see where it is, what it does and a fact worth remembering.</p>' +
        '<p class="lede" style="margin-top:12px">Choose the Skeletal system on the left to click bones directly.</p>';
      return;
    }
    var o = defOf(selected), s = SYS[o.system];
    var same = ORGANS.filter(function (x) { return x.system === o.system && x.id !== o.id; });
    var rel = same.map(function (x) {
      return '<button type="button" class="chip" data-select="' + x.id + '">' + esc(x.name) + '</button>';
    }).join('');
    detailEl.innerHTML =
      '<span class="badge"><i style="background:' + s.color + '"></i>' + esc(s.label) + '</span>' +
      '<h2>' + esc(o.name) + '</h2>' +
      '<div class="info">' +
        '<h3>Where it is</h3><p>' + esc(o.location) + '</p>' +
        '<h3>What it does</h3><p>' + esc(o.function) + '</p>' +
      '</div>' +
      '<div class="fact"><b>Did you know?</b>' + esc(o.fact) + '</div>' +
      '<div class="actions">' +
        '<button type="button" class="btn" data-focus="1">Zoom to organ</button>' +
        '<button type="button" class="btn ghost" data-clear="1">Clear selection</button>' +
      '</div>' +
      (rel ? '<div class="related"><h3>More in the ' + esc(s.label.toLowerCase()) + '</h3>' + rel + '</div>' : '');
    detailEl.scrollTop = 0;
  }

  function select(id, focus) {
    selected = id || null;
    if (selected && isolate && defOf(selected).system !== isolate) isolate = null;
    applyOpacity();
    renderChips();
    renderList();
    renderDetail();
    if (selected && focus !== false) focusOn(selected);
    if (selected) {
      var b = listEl.querySelector('.organ-btn.on');
      if (b && b.scrollIntoView) b.scrollIntoView({ block: 'nearest' });
    }
  }

  function setIsolate(sys) {
    isolate = sys || null;
    if (selected && isolate && defOf(selected).system !== isolate) selected = null;
    applyOpacity();
    renderChips();
    renderList();
    renderDetail();
  }

  function bindUI() {
    chipsEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-sys]');
      if (!b) return;
      var sys = b.getAttribute('data-sys');
      setIsolate(sys && isolate === sys ? null : sys);
    });
    listEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-id]');
      if (b) select(b.getAttribute('data-id'), true);
    });
    detailEl.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-select]'))) select(b.getAttribute('data-select'), true);
      else if (e.target.closest('[data-focus]')) focusOn(selected);
      else if (e.target.closest('[data-clear]')) { select(null); resetView(); }
    });
    searchEl.addEventListener('input', function () {
      query = searchEl.value;
      applyOpacity();
      renderList();
    });
    searchEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var d = visibleDefs();
        if (d.length) select(d[0].id, true);
      } else if (e.key === 'Escape') {
        searchEl.value = ''; query = ''; applyOpacity(); renderList();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && selected && document.activeElement !== searchEl && $('#explore').classList.contains('on')) {
        select(null); resetView();
      }
    });

    if (!has3D) return;
    $('#rotL').addEventListener('click', function () { rotateBy(-45); });
    $('#rotR').addEventListener('click', function () { rotateBy(45); });
    $('#zoomIn').addEventListener('click', function () { zoomBy(0.75); });
    $('#zoomOut').addEventListener('click', function () { zoomBy(1.33); });
    $('#reset').addEventListener('click', resetView);
    $('#auto').addEventListener('click', function () {
      controls.autoRotate = !controls.autoRotate;
      this.setAttribute('aria-pressed', String(controls.autoRotate));
    });
    $('#skin').addEventListener('input', function () {
      var v = this.value / 100;
      skinMat.opacity = v * 0.9;
      skinGroup.visible = v > 0.005;
    });
  }

  /* =====================================================
     START
     ===================================================== */
  renderChips();
  renderList();
  renderDetail();

  if (has3D) {
    try {
      initScene();
    } catch (err) {
      has3D = false;
      stage.innerHTML = '<div class="stage-msg"><p>Your browser could not start 3D graphics (WebGL). Try a recent version of Chrome, Edge, Firefox or Safari. The organ list and the quiz still work.</p></div>';
      if (window.console) console.error(err);
    }
  } else {
    stage.innerHTML = '<div class="stage-msg"><p>The 3D library could not be loaded. Connect to the internet, or follow the offline steps in README.txt. The organ list and the quiz still work.</p></div>';
  }
  bindUI();

  window.BodyApp = {
    select: function (id) { select(id, true); },
    resize: resize
  };
})();
