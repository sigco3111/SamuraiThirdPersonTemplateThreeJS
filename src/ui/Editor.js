import GUI from 'lil-gui';
import { settings } from '../config/settings.js';
import { LITTER_CELLS } from '../world/LeafLitter.js';
import { PresetManager } from './PresetManager.js';

/**
 * Real-time stage editor.
 *
 * Every control binds straight to a field in `config/settings.js`. Because the
 * lights, the floor shader, the dust, the camera rig and the post stack all
 * *read* those fields each frame, no controller needs an onChange handler:
 * moving a slider re-lights the scene on the next frame, with no rebuild and no
 * shader recompilation.
 *
 * That holds while the clock is paused (`P`) — which is the point, since the
 * pose worth lighting is usually a frozen one. The two exceptions are noted
 * where they occur: the floor's stone maps flip a shader define, and the
 * character's scale is resolved once at load.
 */
export class Editor {
  /**
   * @param {object} hooks { onToast, getWeaponFire, onRespawnEnemies, onCastJudgement }
   */
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.presets = new PresetManager();

    this.gui = new GUI({ title: '스테이지 에디터', width: 330 });
    this.gui.domElement.style.setProperty('--title-height', '30px');

    this._presetState = { name: '내 프리셋', selected: this.presets.names[0] ?? '' };
    this._hidden = false;

    this._buildPresets();
    this._buildEnvironment();
    this._buildAir();
    this._buildTerrain();
    this._buildLeaves();
    this._buildFire();
    this._buildShadowCharacter();
    this._buildJudgement();
    this._buildFlight();
    this._buildPost();
    this._buildCamera();
    this._buildCharacter();
    this._buildLocomotion();
    this._buildCombat();
    this._buildStudio();

    // Everything starts collapsed, top-level folders included: the panel opens
    // as a list of sections and the user picks one.
    this.gui.foldersRecursive().forEach((folder) => folder.close());
  }

  /* ------------------------------------------------------------------ */
  /* helpers                                                             */
  /* ------------------------------------------------------------------ */

  static range(folder, object, key, min, max, step, label) {
    return folder.add(object, key, min, max, step).name(label ?? key);
  }

  /** Re-read every control from settings — after a preset load or a reset. */
  refresh() {
    this.gui.controllersRecursive().forEach((controller) => controller.updateDisplay());
  }

  toggle() {
    this._hidden = !this._hidden;
    this.gui.show(!this._hidden);
  }

  /* ------------------------------------------------------------------ */
  /* folders                                                             */
  /* ------------------------------------------------------------------ */

  _buildPresets() {
    const folder = this.gui.addFolder('프리셋');
    const state = this._presetState;

    let selector = folder
      .add(state, 'selected', this.presets.names.length ? this.presets.names : [''])
      .name('프리셋');

    // lil-gui rebuilds the controller when the option list changes, so the
    // reference has to be replaced rather than mutated.
    const refreshOptions = () => {
      const names = this.presets.names;
      selector = selector.options(names.length ? names : ['']).name('프리셋');
      selector.setValue(names.includes(state.selected) ? state.selected : (names[0] ?? ''));
    };

    folder.add(state, 'name').name('이름');

    folder
      .add(
        {
          save: () => {
            this.presets.save(state.name);
            state.selected = state.name;
            refreshOptions();
            this.hooks.onToast?.(`Saved preset "${state.name}"`);
          }
        },
        'save'
      )
      .name('프리셋 저장');

    folder
      .add(
        {
          load: () => {
            if (this.presets.load(state.selected)) {
              this.refresh();
              this.hooks.onToast?.(`Loaded "${state.selected}"`);
            }
          }
        },
        'load'
      )
      .name('프리셋 불러오기');

    folder
      .add(
        {
          duplicate: () => {
            const copy = this.presets.duplicate(state.selected);
            if (copy) {
              state.selected = copy;
              refreshOptions();
              this.hooks.onToast?.(`Duplicated to "${copy}"`);
            }
          }
        },
        'duplicate'
      )
      .name('복제');

    folder
      .add(
        {
          remove: () => {
            if (this.presets.remove(state.selected)) {
              refreshOptions();
              this.hooks.onToast?.('프리셋이 삭제되었습니다');
            }
          }
        },
        'remove'
      )
      .name('삭제');

    folder
      .add({ exportOne: () => this.presets.exportJSON() }, 'exportOne')
      .name('현재 프리셋 내보내기 (JSON)');
    folder.add({ exportAll: () => this.presets.exportAll() }, 'exportAll').name('모든 프리셋 내보내기');

    folder
      .add(
        {
          import: async () => {
            const result = await this.presets.importFromFile();
            refreshOptions();
            this.refresh();
            this.hooks.onToast?.(
              result.applied
                ? '설정을 가져왔습니다'
                : result.imported.length
                  ? `Imported ${result.imported.length} preset(s)`
                  : '가져올 항목이 없습니다'
            );
          }
        },
        'import'
      )
      .name('JSON 가져오기…');

    folder
      .add(
        {
          reset: () => {
            this.presets.reset();
            this.refresh();
            this.hooks.onToast?.('기본값으로 초기화');
          }
        },
        'reset'
      )
      .name('기본값으로 초기화');

    this.presetFolder = folder;
  }

  /* ------------------------------------------------------------------ */

  _buildEnvironment() {
    const folder = this.gui.addFolder('환경');
    const e = settings.environment;
    const R = Editor.range;

    // The key and the rim are the character's own lights. three cannot exclude
    // an object from a light, so the world's surfaces are patched to drop every
    // directional light instead — see `Environment#excludeFromKeyLights`. Off,
    // and the pair go back to lighting the whole landscape.
    folder.add(e, 'keyCharacterOnly').name('키/림 라이트: 캐릭터만');
    R(folder, e, 'sunIntensity', 0, 8, 0.01, '키 라이트 강도');
    folder.addColor(e, 'sunColor').name('키 라이트 색상');
    R(folder, e, 'sunAzimuth', 0, Math.PI * 2, 0.01, '키 라이트 방위각');
    R(folder, e, 'sunElevation', 0.05, 1.5, 0.01, '키 라이트 고도');
    R(folder, e, 'ambientIntensity', 0, 3, 0.01, '환경광');
    folder.addColor(e, 'ambientColor').name('환경광 색상');
    R(folder, e, 'hemiIntensity', 0, 3, 0.01, '반구광');
    R(folder, e, 'envIntensity', 0, 3, 0.01, '환경광 (IBL)');
    R(folder, e, 'shadowRadius', 0, 8, 0.05, '그림자 부드러움');
    R(folder, e, 'shadowBias', -0.01, 0.001, 0.0001, '그림자 바이어스');
    // The pair the character screen has always had and this one did not. Bias
    // works in depth and has to be re-dialled whenever `shadow box` moves; the
    // normal bias is in metres of world and does not. Speckle on a lit surface
    // wants this one raised, a shadow detaching from its feet wants it lowered.
    R(folder, e, 'shadowNormalBias', 0, 0.15, 0.001, '그림자 노멀 바이어스');
    R(folder, e, 'contactShadow', 0, 1.5, 0.01, '접촉 그림자');
    // Half-width of the sun's shadow box. Bigger reaches further out for
    // casters and costs sharpness — the map is a fixed 4096², so this is
    // metres per texel in disguise. The distance below only has to be far
    // enough up-sun to clear the canopy; at a low elevation that is a long way.
    R(folder, e, 'shadowExtent', 12, 120, 1, '그림자 박스 (m)');
    R(folder, e, 'shadowDistance', 40, 400, 5, '태양 거리 (m)');

    const rim = folder.addFolder('림 라이트');
    R(rim, e, 'rimIntensity', 0, 4, 0.01, '림 라이트 강도');
    rim.addColor(e, 'rimColor').name('림 라이트 색상');
    R(rim, e, 'rimAzimuth', 0, Math.PI * 2, 0.01, '림 라이트 방위각');
    R(rim, e, 'rimElevation', 0.05, 1.5, 0.01, '림 라이트 고도');
    rim.addColor(e, 'hemiSkyColor').name('반구광 하늘색');
    rim.addColor(e, 'hemiGroundColor').name('반구광 바닥 반사');

    // `tiled surface` flips USE_MAP, so it costs one shader recompile — fine for
    // an editor toggle, and free while it stays put. Switching sets downloads
    // the other one the first time it is picked.
    const floor = folder.addFolder('무대 바닥');
    floor.add(e, 'floorTexture').name('타일 표면');
    floor.add(e, 'floorTextureSet', ['terrain', 'stone']).name('표면');
    R(floor, e, 'floorTextureScale', 0.5, 24, 0.1, '타일 크기 (m)');
    R(floor, e, 'floorNormalScale', 0, 3, 0.01, '요철 강도');
    R(floor, e, 'floorTexTint', 0, 1, 0.01, '바닥 방향 틴트');
    floor.addColor(e, 'floorColor').name('바닥 색상');
    floor.addColor(e, 'floorTint').name('바닥 틴트');
    R(floor, e, 'floorRoughness', 0.05, 1, 0.01, '거칠기');
    R(floor, e, 'floorSheen', 0, 1, 0.01, '광택');
    R(floor, e, 'floorPool', 0, 1, 0.01, '빛 웅덩이');
  }

  /* ------------------------------------------------------------------ */

  /**
   * Haze, sky and ground mist — one look, in one folder.
   *
   * They are together because they cannot be tuned apart. The sky's horizon *is*
   * the haze colour (bound by identity, which is why there is no control for it
   * under Sky); the mist is lit from the same moon direction the haze glows
   * along, and the moon's own angles live under Sky; and the ground fog's job is
   * to sit in front of a distance the haze has already dissolved. Move one and
   * the others are suddenly wrong.
   */
  _buildAir() {
    const folder = this.gui.addFolder('공기, 하늘, 안개');
    const R = Editor.range;

    const h = settings.haze;
    const haze = folder.addFolder('원경 헤이즈');
    haze.add(h, 'enabled').name('헤이즈 활성화');
    haze.addColor(h, 'color').name('헤이즈 색상');
    haze.addColor(h, 'sunColor').name('달 방향 색상');
    // 1/m, so the number itself means very little; the readout under it is what
    // you actually aim.
    R(haze, h, 'density', 0, 0.03, 0.0002, '원경 헤이즈 (1/m)');
    R(haze, h, 'start', 0, 40, 0.5, '맑은 공기 (m)');
    haze
      .add(
        {
          get halfAt() {
            const d = settings.haze.density;
            return d > 1e-5 ? Math.round(Math.LN2 / d + settings.haze.start) : 9999;
          }
        },
        'halfAt'
      )
      .name('절반이 숨겨지는 거리 (m)')
      .listen()
      .disable();
    // The layer that pools in the hollows. `mist floor` is the world height it
    // sits on and `mist depth` is how fast it thins going up — between them
    // they decide whether it is a ground effect or a wall.
    R(haze, h, 'ground', 0, 0.12, 0.001, '지상 안개 (1/m)');
    R(haze, h, 'base', -12, 12, 0.1, '안개 바닥 (m)');
    R(haze, h, 'falloff', 0.5, 40, 0.1, '안개 깊이 (m)');
    // How far the air goes toward the moon's colour looking down the beam. The
    // highest-value control in this folder: at 0 the haze is a flat wash from
    // every angle, which is the one thing real air never is.
    R(haze, h, 'inscatter', 0, 1, 0.01, '달 산란광');
    R(haze, h, 'sunPower', 1, 24, 0.1, '산란 집중도');
    R(haze, h, 'max', 0, 1, 0.01, '헤이즈 상한');

    const s = settings.sky;
    const sky = folder.addFolder('하늘');
    sky.add(s, 'enabled').name('하늘 활성화');
    sky.addColor(s, 'zenith').name('천정');
    R(sky, s, 'gradient', 0.1, 3, 0.01, '그라데이션');
    R(sky, s, 'sunGlow', 0, 12, 0.05, '달 후광');
    R(sky, s, 'sunGlowPower', 1, 60, 0.5, '후광 집중도');
    R(sky, s, 'broadGlow', 0, 3, 0.01, '넓은 빛');
    R(sky, s, 'exposure', 0, 3, 0.01, '하늘 노출');

    // The moon. `disc size` is 1 - cos of the half-angle, so the numbers look
    // small — 0.006 is about six degrees across, which is a dozen times life
    // size and exactly what the reference is.
    const moon = sky.addFolder('달');
    // Where it hangs — and the world's one light direction with it: the sky's
    // glare, the haze's inscatter lobe and the mist's lit side all resolve from
    // this pair (`Sky#_placeMoon` writes `frame.uLightDir`). The character's key
    // is a *different* angle, over in Environment.
    //
    // Elevation is capped low on purpose. The rig cannot aim much above 30°
    // (`camera.maxPolar`), so a moon parked higher than this is off the top of
    // the frame and only its glare is ever on screen — which is exactly why it
    // used to be invisible at the old 0.72.
    R(moon, s.moon, 'azimuth', 0, Math.PI * 2, 0.01, '회전 (방위각)');
    R(moon, s.moon, 'elevation', -0.05, 0.6, 0.005, '고도');
    R(moon, s, 'disc', 0, 40, 0.1, '밝기');
    R(moon, s, 'discSize', 0.0005, 0.05, 0.0005, '크기');
    moon.addColor(s.moon, 'color').name('색상');

    // The body — a displaced sphere wearing a real lunar surface material
    // (`world/Moon.js`). Off, and the sky goes back to drawing the disc itself,
    // which is the only thing the two `maria` sliders at the bottom still feed.
    const body = moon.addFolder('표면');
    body.add(s.moon, 'geometry').name('텍스처 적용 본체');
    // The body's own two masters. `brightness` above is `sky.disc`, which is
    // also the glare's and what the haze's lobe is sized against — these two
    // are the ones to reach for when the sphere itself is too hot or too solid,
    // because they move it and nothing else. Both at 1 is untouched.
    R(body, s.moon, 'brightness', 0, 3, 0.01, '본체 밝기');
    R(body, s.moon, 'opacity', 0, 1, 0.01, '본체 불투명도');
    // The one control here that changes the picture rather than the finish:
    // where the moon's *own* sun is, from full through half to new.
    R(body, s.moon, 'phase', 0, Math.PI, 0.01, '위상 (보름 → 삭)');
    R(body, s.moon, 'phaseTilt', -1.2, 1.2, 0.01, '위상 기울기');
    R(body, s.moon, 'terminator', 0.005, 0.5, 0.005, '명암경계 부드러움');
    R(body, s.moon, 'flatten', 0.1, 2, 0.01, '윤곽 평탄도');
    R(body, s.moon, 'earthshine', 0, 0.4, 0.005, '지구조명');
    R(body, s.moon, 'edge', 0.001, 0.4, 0.001, '윤곽 페이드');
    R(body, s.moon, 'displacement', 0, 0.25, 0.005, '요철 (형태)');
    R(body, s.moon, 'relief', 0, 1, 0.01, '요철 (법선)');
    R(body, s.moon, 'ao', 0, 1, 0.01, '크레이터 그림자 (AO)');
    R(body, s.moon, 'sheen', 0, 0.5, 0.005, '광택');
    R(body, s.moon, 'textureScale', 0.2, 6, 0.05, '크레이터 스케일');
    R(body, s.moon, 'blendSharpness', 1, 16, 0.5, '투영 블렌드');
    R(body, s.moon, 'tilt', -Math.PI, Math.PI, 0.01, '면 기울기');
    R(body, s.moon, 'spin', -Math.PI, Math.PI, 0.01, '면 회전');

    // Fallback disc only: with the body up, `Sky` is not drawing a disc at all.
    R(moon, s.moon, 'detail', 0, 1, 0.01, '달의 바다 (원반 전용)');
    R(moon, s.moon, 'detailScale', 1, 24, 0.1, '달의 바다 크기 (원반 전용)');

    // One hash per lattice cell, so the whole sky of them is about the price of
    // a single texture lookup. `density` is cells per unit direction: up packs
    // more in and shrinks each one.
    const stars = sky.addFolder('별');
    const st = s.stars;
    stars.add(st, 'enabled').name('별 활성화');
    R(stars, st, 'density', 40, 600, 5, '밀도');
    R(stars, st, 'brightness', 0, 6, 0.05, '밝기');
    R(stars, st, 'twinkle', 0, 1, 0.01, '반짝임');
    R(stars, st, 'horizon', 0, 0.6, 0.01, '지평선 아래 소멸 (sin 고도)');

    this._buildGroundFog(folder);
  }

  /**
   * The mist that rolls over the ground — see `world/GroundFog.js`.
   *
   * A sub-folder of the air rather than a folder of its own, because it is the
   * near half of the same effect: the haze above dissolves the distance, and
   * this puts something between you and it that has a shape and moves.
   *
   * Everything here is live. `count` is the only control that touches a buffer,
   * and even that only reveals or hides slots that were allocated at boot — the
   * mist never rebuilds.
   */
  _buildGroundFog(parent) {
    const folder = parent.addFolder('지상 안개 (이미터)');
    const f = settings.groundFog;
    const R = Editor.range;

    folder.add(f, 'enabled').name('활성화');
    // Density is `count` against `life`: a slot respawns the instant it dies, so
    // the emitter is releasing count/life puffs a second. `count` is also the
    // fill-rate dial — it is the first thing to turn down if the frame is tight.
    R(folder, f, 'count', 0, 512, 1, '퍼프 수 (비용)');
    R(folder, f, 'life', 1, 60, 0.5, '수명 (초)');
    R(folder, f, 'lifeVariance', 0, 0.95, 0.01, '수명 편차');
    R(folder, f, 'opacity', 0, 1, 0.01, '불투명도');

    // Where it comes from. `follow` parks the emitter on the character, which is
    // what keeps mist around the camera on an endless floor; off, x/z are a
    // fixed world position and the bank stays in the hollow you put it in.
    const emitter = folder.addFolder('이미터');
    emitter.add(f, 'follow').name('캐릭터 추종');
    R(emitter, f, 'x', -200, 200, 0.5, 'x / X 오프셋 (m)');
    R(emitter, f, 'z', -200, 200, 0.5, 'z / Z 오프셋 (m)');
    R(emitter, f, 'radius', 0, 120, 0.5, '스폰 반경 (m)');
    // The hole kept clear around the lens. Nothing else in this panel can fix a
    // puff sitting between you and the character: raise this until the closest
    // mist is behind the camera's own distance to them.
    R(emitter, f, 'nearFade', 0, 40, 0.25, '카메라로부터 거리 (m)');
    R(emitter, f, 'nearFadeRange', 0.5, 40, 0.25, '클리어 구간 (m)');

    const drift = folder.addFolder('흐름');
    R(drift, f, 'windX', -8, 8, 0.05, '바람 X (m/s)');
    R(drift, f, 'windZ', -8, 8, 0.05, '바람 Z (m/s)');
    R(drift, f, 'rise', -1, 2, 0.01, '상승 (m/s)');
    R(drift, f, 'hover', -1, 8, 0.05, '지면 위 떠있기 (m)');
    R(drift, f, 'swirl', 0, 8, 0.05, '표류 (m)');
    R(drift, f, 'swirlSpeed', 0, 1.5, 0.01, '표류 속도');
    R(drift, f, 'spin', 0, 1, 0.005, '회전 (rad/s)');

    const look = folder.addFolder('외형');
    R(look, f, 'sizeStart', 0.2, 40, 0.1, '탄생 시 크기 (m)');
    R(look, f, 'sizeEnd', 0.2, 60, 0.1, '소멸 시 크기 (m)');
    look.addColor(f, 'color').name('안개 색상');
    look.addColor(f, 'litColor').name('달 방향 색상');
    R(look, f, 'moonlight', 0, 1.5, 0.01, '달빛');
    R(look, f, 'moonPower', 0.5, 12, 0.1, '달빛 집중도');
    R(look, f, 'softness', 0.02, 1, 0.01, '가장자리 부드러움');
    R(look, f, 'fadeIn', 0.01, 0.9, 0.01, '페이드 인 (수명 대비)');
    R(look, f, 'fadeOut', 0.01, 0.9, 0.01, '페이드 아웃 (수명 대비)');
    // What hides the line where a billboard crosses the terrain. Too small and
    // the cut shows; too large and the mist floats off the ground.
    R(look, f, 'groundFade', 0.05, 8, 0.05, '지면으로 융해 (m)');
    R(look, f, 'detail', 0, 1, 0.01, '노이즈 분산');
    R(look, f, 'detailScale', 0.5, 12, 0.1, '분산 크기');
  }

  /* ------------------------------------------------------------------ */

  /**
   * The shape of the ground — see `world/Terrain.js`.
   *
   * Every control here is a shader uniform read by the floor *and* the CPU that
   * stands the character up, so the landscape can be redialled while walking
   * over it and the body keeps its feet on whatever comes out. The two that are
   * not free are called out below.
   */
  _buildTerrain() {
    const folder = this.gui.addFolder('지형');
    const t = settings.terrain;
    const R = Editor.range;

    folder.add(t, 'enabled').name('지형 활성화');
    R(folder, t, 'amplitude', 0, 20, 0.05, '높이 (m)');
    R(folder, t, 'scale', 8, 200, 1, '언덕 크기 (m)');
    // The one real cost dial: the floor evaluates this field five times per
    // vertex (the height and its normal), so an octave here is paid for by
    // every vertex of the grid.
    R(folder, t, 'octaves', 1, 6, 1, '디테일 (비용)');
    R(folder, t, 'warp', 0, 2, 0.01, '왜곡 (계곡)');
    R(folder, t, 'ridge', 0, 1, 0.01, '능선');

    const shape = folder.addFolder('미세 형태');
    R(shape, t, 'lacunarity', 1.5, 3, 0.01, '옥타브 간격');
    R(shape, t, 'gain', 0.2, 0.7, 0.01, '옥타브 감쇠');
    R(shape, t, 'seed', 0, 60, 0.1, '씨드').listen();
    shape
      .add(
        {
          randomize: () => {
            t.seed = Math.random() * 60;
          }
        },
        'randomize'
      )
      .name('지형 랜덤 생성');
    // The only control in this folder that rebuilds anything: it swaps the
    // floor's grid, which is a one-frame hitch and 400 m / segments of vertex
    // spacing. Below about 128 the hills go visibly faceted in silhouette.
    shape
      .add(t, 'segments', [64, 128, 192, 256, 384, 512, 768])
      .name('바닥 메시 디테일')
      .onChange((value) => {
        this.hooks.onToast?.(`Floor grid: ${(400 / value).toFixed(2)} m between vertices`);
      });
  }

  /**
   * The litter on the floor and the leaves in the air — see `world/Leaves.js`.
   *
   * One folder, because they are one look: the sheet, the grade, the backlight
   * and the wind at the top are shared by both populations by identity, and only
   * the two sub-folders differ. Everything here is live — the one control that
   * recompiles is the coverage switch, and it is called out where it sits.
   *
   * The control worth reaching for first is `backlight`. Leaves are one cell
   * thick and they glow when the moon is behind them; at 0 they are opaque chips
   * and the whole field reads as stickers on the ground.
   */
  _buildLeaves() {
    const folder = this.gui.addFolder('낙엽');
    const g = settings.leaves;
    const R = Editor.range;

    folder.add(g, 'enabled').name('낙엽 활성화');
    R(folder, g, 'size', 0.02, 0.6, 0.005, '잎 길이 (m)');
    R(folder, g, 'sizeVariance', 0, 0.9, 0.01, '크기 편차');

    // The sheet is a daylight photograph of a green beech and this stage is a
    // blue night. Without this the leaves are the one summer-coloured thing in
    // the frame.
    const look = folder.addFolder('그라데이션과 역광');
    look.addColor(g, 'tint').name('그라데이션');
    R(look, g, 'tintAmount', 0, 1, 0.01, '틴트 양');
    look.addColor(g, 'backlightColor').name('잎 사이 빛 색상');
    R(look, g, 'backlight', 0, 3, 0.01, '역광');
    R(look, g, 'backlightPower', 1, 24, 0.5, '역광 집중도');
    R(look, g, 'roughness', 0.02, 1, 0.01, '거칠기');
    R(look, g, 'normalScale', 0, 3, 0.05, '요철 (법선)');

    // The cut-out. Lower is a fatter leaf and a rougher edge; the coverage
    // switch is what keeps that edge from crawling, and it is the only control
    // in this folder that recompiles. It does nothing until there is MSAA to
    // resolve against — raise `samples` under Post processing first.
    const cut = look.addFolder('잘라내기');
    R(cut, g, 'alphaTest', 0.05, 0.95, 0.01, '알파 컷오프');
    cut
      .add(g, 'alphaToCoverage')
      .name('부드러운 가장자리 (MSAA 필요)')
      .onChange((value) => {
        if (value && (settings.post.samples ?? 0) === 0) {
          this.hooks.onToast?.('부드러운 잎 가장자리는 후처리 → 샘플 수 0 이상 필요');
        }
      });
    R(cut, g, 'atlasInset', 0, 0.15, 0.005, '시트 인셋');

    // One wind for both populations: it quivers the litter where it lies and
    // carries the leaves in the air, so a gust crosses the whole field at once.
    const wind = folder.addFolder('바람');
    R(wind, g, 'windX', -8, 8, 0.05, '바람 X (m/s)');
    R(wind, g, 'windZ', -8, 8, 0.05, '바람 Z (m/s)');
    R(wind, g, 'gustSpeed', 0, 3, 0.01, '돌풍 속도');
    R(wind, g, 'gustScale', 0.005, 0.4, 0.005, '돌풍 크기 (rad/m)');
    R(wind, g, 'gustStrength', 0, 3, 0.01, '돌풍 강도');

    /* ---- the ground ---- */
    const l = g.litter;
    const litter = folder.addFolder('낙엽 더미 (지면 위)');
    litter.add(l, 'enabled').name('낙엽 더미 활성화');
    // The two cost dials. Live like everything else — they only decide where
    // the leaves are laid out, so moving one re-lays the grid rather than
    // rebuilding a buffer. `perCell` × 400 is the leaf count.
    R(litter, l, 'perCell', 1, 20, 1, '셀당 (비용)');
    R(litter, l, 'field', 20, 120, 1, '윈도우 (m)');
    litter
      .add(
        {
          get leaves() {
            return Math.round(settings.leaves.litter.perCell) * LITTER_CELLS * LITTER_CELLS;
          }
        },
        'leaves'
      )
      .name('낙엽 그리기')
      .listen()
      .disable();
    R(litter, l, 'hover', 0, 0.2, 0.002, '바닥 위 부유 (m)');
    R(litter, l, 'rustle', 0, 1, 0.01, '바람 떨림 (rad)');
    // Keep `gone by` inside half the window, or the edge of the field itself
    // comes into view.
    R(litter, l, 'fadeStart', 2, 80, 0.5, '침식 시작 (m)');
    R(litter, l, 'fadeEnd', 3, 100, 0.5, '소멸 거리 (m)');

    // What a foot does to them. `push speed` is the dead band that stops the
    // leaves under a standing character boiling; `forward blend` is what turns
    // the throw from an explosion underneath you into a sweep.
    const push = litter.addFolder('발 아래');
    R(push, l, 'pushRadius', 0.1, 3, 0.05, '휩쓸기 반경 (m)');
    R(push, l, 'pushLead', -1, 2, 0.05, '몸 앞 휩쓸기 (m)');
    R(push, l, 'pushForce', 0, 3, 0.01, '힘');
    R(push, l, 'pushLift', 0, 2, 0.01, 'lift');
    R(push, l, 'pushForward', 0, 1, 0.01, '전방 블렌드');
    R(push, l, 'pushSpeed', 0, 3, 0.05, '최소 이동 (m/s)');
    R(push, l, 'pushBudget', 1, 200, 1, '프레임당 잎 수 (상한)');

    // And what the wind does: a few a second come unstuck and skitter downwind.
    const skitter = litter.addFolder('바람에 날림');
    R(skitter, l, 'gustRate', 0, 60, 0.5, '초당 들어올림');
    R(skitter, l, 'gustForce', 0, 3, 0.01, '힘');
    R(skitter, l, 'gustLift', 0, 2, 0.01, 'lift');
    R(skitter, l, 'gustSpread', 0, 3.2, 0.05, '팬 각도 (rad)');

    // The flight itself. The swirl and the spin both die out exactly as the leaf
    // lands, which is what makes the landing place computable — and that is what
    // lets a leaf be kicked again from where it came down.
    const flight = litter.addFolder('비행');
    R(flight, l, 'flight', 0.1, 5, 0.05, '비행 (초)');
    R(flight, l, 'drag', 0.1, 8, 0.05, 'drag');
    R(flight, l, 'swirl', 0, 1.5, 0.01, '소용돌이 (m)');
    R(flight, l, 'swirlSpeed', 0, 20, 0.1, '소용돌이 속도');
    R(flight, l, 'spin', 0, 60, 0.5, '구르기 (rad/s)');

    /* ---- the air ---- */
    const d = g.drift;
    const drift = folder.addFolder('흐름 (공중)');
    drift.add(d, 'enabled').name('흐름 활성화');
    R(drift, d, 'count', 0, 1024, 1, '잎 수 (비용)');
    R(drift, d, 'radius', 2, 90, 0.5, '스폰 반경 (m)');
    R(drift, d, 'life', 2, 60, 0.5, '수명 (초)');
    R(drift, d, 'lifeVariance', 0, 0.9, 0.01, '수명 편차');
    R(drift, d, 'heightMin', 0, 20, 0.1, '출발 거리 (m)');
    R(drift, d, 'heightMax', 0, 40, 0.1, '도착 거리 (m)');
    R(drift, d, 'sizeScale', 0.1, 4, 0.05, '낙엽 대비 크기');

    // The glide. A leaf is a wing: it does not drop, it swings across its own
    // fall, and this pair is most of why these read as leaves.
    const fall = drift.addFolder('낙하와 휘날림');
    R(fall, d, 'fall', 0, 4, 0.01, '침하 (m/s)');
    R(fall, d, 'flutter', 0, 3, 0.01, '휘두름 (m)');
    R(fall, d, 'flutterSpeed', 0, 8, 0.05, '휘두름 속도');
    R(fall, d, 'tumble', 0, 4, 0.01, '회전 종료');
    R(fall, d, 'yawDrift', 0, 3, 0.01, '요 드리프트 (rad/s)');
    // What makes one land instead of stopping dead on its edge.
    R(fall, d, 'settle', 0.05, 5, 0.05, '평탄화 거리 (m)');
    R(fall, d, 'hover', 0, 0.3, 0.005, '바닥 위 휴지 (m)');

    const seen = drift.addFolder('페이드');
    R(seen, d, 'fadeIn', 0.005, 0.5, 0.005, '인 (수명 대비)');
    R(seen, d, 'fadeOut', 0.005, 0.6, 0.005, '아웃 (수명 대비)');
    R(seen, d, 'fadeStart', 2, 90, 0.5, '침식 시작 (m)');
    R(seen, d, 'fadeEnd', 3, 120, 0.5, '소멸 거리 (m)');
    // Nothing else can fix a leaf sitting on the lens.
    R(seen, d, 'nearFade', 0, 6, 0.05, '카메라로부터 거리 (m)');
    R(seen, d, 'nearFadeRange', 0.05, 6, 0.05, '클리어 구간 (m)');
  }

  /**
   * The burning katana — see `vfx/WeaponFire.js`.
   *
   * The box block is the aim and everything under it is the look. Those box
   * numbers are shared with the gizmo in the character screen, so they are
   * `listen()`ed: dragging the volume against the body moves these sliders, and
   * typing here moves the volume. `Refit` throws both away and puts the box back
   * around the whole weapon.
   */
  _buildFire() {
    const folder = this.gui.addFolder('칼날의 불꽃');
    const f = settings.fire;
    const R = Editor.range;
    const weapon = () => this.hooks.getWeaponFire?.() ?? null;

    folder.add(f, 'enabled').name('활성화');
    R(folder, f, 'intensity', 0, 3, 0.01, '강도');

    // What is alight. `faces` is the count the box is currently keeping — the
    // fastest way to tell a box that missed the blade from one that is simply
    // pointed somewhere dark.
    const box = folder.addFolder('이미터 박스');
    const b = f.box;
    box.add(b, 'show').name('와이어프레임 표시').listen();
    box.add(b, 'autoFit').name('장착 시 자동 맞춤');
    box
      .add(
        {
          refit: () => {
            const fire = weapon();
            this.hooks.onToast?.(
              fire?.refit() ? '불꽃 박스를 무기에 재맞춤했습니다' : '장착된 무기가 없습니다'
            );
          }
        },
        'refit'
      )
      .name('무기에 재맞춤');

    const readout = {
      get faces() {
        const fire = weapon();
        return fire ? `${fire.faceCount} 면 발화` : '무기 없음';
      }
    };
    box.add(readout, 'faces').name('방출 중').disable().listen();

    R(box, b, 'x', -1, 1, 0.001, 'X 오프셋 (m)').listen();
    R(box, b, 'y', -1, 1, 0.001, 'Y 오프셋 (m)').listen();
    R(box, b, 'z', -1, 1, 0.001, 'Z 오프셋 (m)').listen();
    R(box, b, 'rotX', -180, 180, 0.5, 'X 회전 (°)').listen();
    R(box, b, 'rotY', -180, 180, 0.5, 'Y 회전 (°)').listen();
    R(box, b, 'rotZ', -180, 180, 0.5, 'Z 회전 (°)').listen();
    R(box, b, 'scaleX', 0.02, 4, 0.01, 'X 크기').listen();
    R(box, b, 'scaleY', 0.02, 4, 0.01, 'Y 크기').listen();
    R(box, b, 'scaleZ', 0.02, 4, 0.01, 'Z 크기').listen();
    R(box, b, 'sizeX', 0.005, 2, 0.001, 'X 크기 (m)').listen();
    R(box, b, 'sizeY', 0.005, 2, 0.001, 'Y 크기 (m)').listen();
    R(box, b, 'sizeZ', 0.005, 2, 0.001, 'Z 크기 (m)').listen();

    // The flame body: a raymarched black-body volume wrapped around a distance
    // field of the selected faces. `thickness` is the first dial to reach for —
    // it is how much burning gas there is off the steel, in metres.
    const volume = folder.addFolder('불꽃 본체');
    const v = f.volume;
    volume.add(v, 'enabled').name('활성화');
    R(volume, v, 'thickness', 0.002, 0.3, 0.001, '두께 (m)');
    R(volume, v, 'plume', 1, 6, 0.01, '기류 늘림');
    R(volume, v, 'length', 0.05, 2, 0.01, '기류 길이 (m)');
    R(volume, v, 'spread', 0, 4, 0.01, '시간 경과로 확장');
    R(volume, v, 'rise', 0.1, 8, 0.01, '부력 흐름 (m/s)');
    R(volume, v, 'inherit', 0, 1.5, 0.01, '칼날 휘어짐 속도');
    R(volume, v, 'glow', 0, 20, 0.01, '방출');
    R(volume, v, 'density', 0, 6, 0.01, '밀도');
    R(volume, v, 'opacity', 0, 1, 0.01, '불투명도');
    R(volume, v, 'steps', 8, 64, 1, '마칭 스텝');

    const shape = volume.addFolder('난류');
    R(shape, v, 'softness', 0.05, 1, 0.01, '가장자리 부드러움');
    R(shape, v, 'shred', 0, 3, 0.01, '프린지 찢김');
    R(shape, v, 'bulge', 0, 1, 0.01, '실루엣 엽');
    R(shape, v, 'bulgeScale', 1, 30, 0.1, '미터당 엽 수');
    R(shape, v, 'detachment', 0, 2, 0.01, '끝 분리');
    R(shape, v, 'buoyancy', 0, 6, 0.01, '필드 상승');
    R(shape, v, 'noiseFrequency', 2, 40, 0.1, '디테일 크기');
    R(shape, v, 'noiseStrength', 0, 3, 0.01, '노이즈 강도');
    R(shape, v, 'warp', 0, 1, 0.01, '도메인 왜곡');
    R(shape, v, 'tongue', 0.5, 6, 0.01, '혀 늘림');
    R(shape, v, 'lick', 0, 6, 0.01, '프린지 핥기');
    R(shape, v, 'wisps', 0, 2, 0.01, '잔류 연기');
    R(shape, v, 'flicker', 0, 1.5, 0.01, '깜빡임');
    R(shape, v, 'octaves', 1, 5, 1, '옥타브');

    // The physics half. `palette` is the escape hatch: 0 is a pure radiator,
    // 1 hands the colour back to the four stops under Palette.
    const heat = volume.addFolder('온도');
    R(heat, v, 'tempCore', 1200, 6000, 10, '코어 (K)');
    R(heat, v, 'tempEdge', 1000, 3000, 10, '가장자리 (K)');
    R(heat, v, 'emissionCurve', 1, 6, 0.05, '방사율 지수');
    R(heat, v, 'heatFocus', 0.1, 3, 0.01, '열 집중');
    R(heat, v, 'heatFalloff', 0.1, 4, 0.01, '열 감쇠');
    R(heat, v, 'heatFollow', 0, 1, 0.01, '온도 노이즈');
    R(heat, v, 'tailHeat', 0, 1, 0.01, '끝 온도');
    R(heat, v, 'palette', 0, 1, 0.01, '물리 대신 팔레트');
    R(heat, v, 'scatter', 0, 4, 0.01, '산란 입사');
    R(heat, v, 'scatterFalloff', 0.5, 8, 0.01, '산란 감쇠');
    R(heat, v, 'soot', 0, 4, 0.01, '그을음 흡수');
    R(heat, v, 'coreClarity', 0, 1, 0.01, '코어 선명도');

    // Only in force as `palette` above is turned up — at 0 the colour is the
    // black-body physics and these four stops do nothing.
    const palette = volume.addFolder('팔레트');
    palette.addColor(v, 'colorCore').name('코어');
    palette.addColor(v, 'colorMid').name('중간');
    palette.addColor(v, 'colorEdge').name('가장자리');
    palette.addColor(v, 'colorSmoke').name('연기');

    // The steel's own glow — see `vfx/BladeHeat.js`. `edge boost` is the dial
    // that draws the white filament down the cutting edge, and `char` is what
    // stops the key light's specular sitting on top of it.
    const steel = folder.addFolder('달궈진 강철');
    const s = f.steel;
    steel.add(s, 'enabled').name('활성화');
    R(steel, s, 'amount', 0, 3, 0.01, 'glow');
    R(steel, s, 'tempCore', 1000, 4000, 10, '최고 온도 (K)');
    R(steel, s, 'tempEdge', 900, 3000, 10, '최저 온도 (K)');
    R(steel, s, 'curve', 1, 6, 0.05, '방사율 지수');
    R(steel, s, 'edge', 0, 5, 0.01, '가장자리 부스트');
    R(steel, s, 'edgeSharpness', 0.5, 8, 0.05, '가장자리 집중도');
    R(steel, s, 'detail', 0, 1, 0.01, '불균일 열');
    R(steel, s, 'scale', 1, 40, 0.1, '열 디테일 크기');
    R(steel, s, 'speed', 0, 4, 0.01, '열 크롤');
    R(steel, s, 'relief', 0, 1, 0.01, '텍스처 요철');
    R(steel, s, 'falloff', 0.01, 1, 0.01, '박스 가장자리 페이드');
    R(steel, s, 'char', 0, 1, 0.01, '강철 그을림');

    // Sparks born on the selected triangles — see `vfx/EmberSystem.js`. `rate`
    // and `life` together decide how many are alive; `streak` is the motion
    // blur that keeps them from reading as dots.
    const embers = folder.addFolder('불씨');
    const em = f.embers;
    embers.add(em, 'enabled').name('활성화');

    const live = {
      get count() {
        const fire = weapon();
        return fire ? `${fire.emberCount} 비행 중` : '무기 없음';
      }
    };
    embers.add(live, 'count').name('스파크').disable().listen();

    R(embers, em, 'rate', 0, 1500, 1, '초당 발생');
    R(embers, em, 'swing', 0, 2, 0.01, '휘두를수록 강해짐');
    R(embers, em, 'life', 0.1, 6, 0.01, '수명 (초)');
    R(embers, em, 'lifeVariance', 0, 0.95, 0.01, '수명 편차');
    R(embers, em, 'emission', 0, 20, 0.01, '밝기');
    R(embers, em, 'size', 0.001, 0.05, 0.0005, '반경 (m)');
    R(embers, em, 'sizeVariance', 0, 0.95, 0.01, '크기 편차');
    R(embers, em, 'shrink', 0, 2, 0.01, '소멸 시 크기');
    R(embers, em, 'core', 0, 12, 0.05, '코어 집중도');
    R(embers, em, 'twinkle', 0, 1, 0.01, '반짝임');

    const launch = embers.addFolder('발사');
    R(launch, em, 'standoff', 0, 0.05, 0.0005, '이격 거리 (m)');
    R(launch, em, 'eject', 0, 3, 0.01, '면 이탈 (m/s)');
    R(launch, em, 'rise', 0, 4, 0.01, '흐름 따라 (m/s)');
    R(launch, em, 'spread', 0, 2, 0.01, '산란 (m/s)');
    R(launch, em, 'inherit', 0, 1.5, 0.01, '칼날 보존 속도');

    const flight = embers.addFolder('비행');
    R(flight, em, 'buoyancy', 0, 8, 0.01, '부력 (m/s²)');
    R(flight, em, 'drag', 0.05, 6, 0.01, '공기 저항 (1/s)');
    R(flight, em, 'turbulence', 0, 2, 0.01, '표류 (m)');
    R(flight, em, 'turbulenceScale', 0.2, 12, 0.05, '표류 디테일');
    R(flight, em, 'turbulenceSpeed', 0, 4, 0.01, '표류 속도');
    R(flight, em, 'stretch', 0, 6, 0.01, '잔상 / (m/s)');
    R(flight, em, 'maxStretch', 1, 24, 0.1, '잔상 한도');

    const cooling = embers.addFolder('냉각');
    R(cooling, em, 'tempBirth', 1200, 4000, 10, '탄생 (K)');
    R(cooling, em, 'tempDeath', 800, 2500, 10, '소멸 온도 (K)');
    R(cooling, em, 'curve', 1, 6, 0.05, '방사율 지수');
    R(cooling, em, 'cool', 0.1, 4, 0.01, '냉각 빠름 ↔ 늦음');

    const light = folder.addFolder('불빛');
    const li = f.light;
    light.add(li, 'enabled').name('활성화');
    R(light, li, 'intensity', 0, 60, 0.1, '강도 (cd)');
    R(light, li, 'distance', 0.5, 15, 0.1, '도달 거리 (m)');
    R(light, li, 'decay', 0, 3, 0.01, '감쇠');
    light.addColor(li, 'color').name('색상');
    R(light, li, 'flicker', 0, 1, 0.01, '깜빡임');
  }

  /**
   * The two summoned shadows — see `vfx/ShadowCharacter.js`.
   *
   * `V` arms the mark and the last lock writes the same `active` flag this
   * checkbox does, so the two agree either way round (hence the `listen()`).
   * Ticking it here is the one summon that skips the marking entirely: with
   * nothing assigned each shadow takes the nearest body it can have, which is
   * what the pair did before there was anything to mark. Everything else is
   * sampled by the shadow material every frame, so they can be re-dressed while
   * they are standing beside the body.
   */
  _buildShadowCharacter() {
    const folder = this.gui.addFolder('그림자 분신');
    const s = settings.shadowCharacter;
    const R = Editor.range;

    folder.add(s, 'active').name('소환 (표시 안됨)').listen();
    R(folder, s, 'offset', 0, 4, 0.01, '양옆 거리 (m)');
    R(folder, s, 'back', -2, 3, 0.01, '뒤쪽 (m)');
    R(folder, s, 'scale', 0.3, 2, 0.01, '크기 ×');
    R(folder, s, 'emerge', 0, 2, 0.01, '발 꺼냄 (초)');
    R(folder, s, 'crouch', 0, 6, 0.05, '앉은 자세 유지 (초)');

    // Choosing who they go for — `V`, the aim, and the diamond over the head.
    // `aim` is the one to reach for: it is how far off the middle of the frame
    // a body may be and still be the one meant, as a fraction of the screen's
    // height, so it is the difference between a look and a pixel hunt.
    const mark = folder.addFolder('표식');
    const m = s.marking;
    R(mark, m, 'count', 1, 2, 1, '표시할 적 수');
    R(mark, m, 'range', 4, 80, 0.5, '표시 가능 거리 (m)');
    R(mark, m, 'aim', 0.02, 0.6, 0.005, '조준 허용 (스크린)');
    R(mark, m, 'timeout', 0, 60, 0.5, '팔 만료 시간 (초)');

    const marker = mark.addFolder('다이아몬드');
    const ml = m.look;
    marker.addColor(ml, 'color').name('조준점 아래');
    marker.addColor(ml, 'lockColor').name('잠김');
    R(marker, ml, 'size', 0.1, 2, 0.01, '크기 (m)');
    R(marker, ml, 'lift', 0, 2, 0.01, '머리 위 (m)');
    R(marker, ml, 'width', 0.01, 0.5, 0.005, '윤곽 폭');
    R(marker, ml, 'softness', 0.005, 0.3, 0.005, '페더링');
    R(marker, ml, 'intensity', 0, 6, 0.05, '밝기');
    R(marker, ml, 'pulse', 0, 1, 0.01, '호흡 깊이');
    R(marker, ml, 'pulseSpeed', 0, 20, 0.1, '호흡 속도');
    R(marker, ml, 'pop', 0, 2, 0.01, '잠금 스냅');
    R(marker, ml, 'fadeIn', 0.01, 1, 0.01, '페이드 인 (초)');
    R(marker, ml, 'fadeOut', 0.01, 1, 0.01, '페이드 아웃 (초)');

    // The errand: from the crouch to the blow landing. Where the run stops is
    // the striking move's own `standoff` under Combat, the ground its warp
    // covers, and the slack here.
    const hunt = folder.addFolder('추격');
    const h = s.hunt;
    R(hunt, h, 'speed', 0.5, 12, 0.05, '달리기 속도 (m/s)');
    // The pose only — the approach is aimed at the target, so no value here can
    // cost the pair a kill.
    R(hunt, h, 'turnRate', 0.000001, 0.05, 0.000001, '회전 추종');
    R(hunt, h, 'slack', 0, 1, 0.01, '이격 여유 (m)');
    R(hunt, h, 'timeout', 1, 30, 0.5, '포기 시간 (초)');

    // What it finishes with — one of the player's own attacks, thrown on that
    // move's numbers under Combat. `lead` is the hand-over from run to move:
    // at 1 the body keeps the speed it arrived at, which is the join to watch.
    const strike = folder.addFolder('강타');
    const st = s.strike;
    strike
      .add(st, 'move', { '슬라이드 베기': 'crouchSlash', '참격': 'slashHit', kick: 'kick' })
      .name('마무리');
    R(strike, st, 'lead', 0.2, 2, 0.01, '브레이크 ↔ 돌진');

    // The vanish — the same noise burn the enemies die by, in violet.
    const dissolve = folder.addFolder('소멸');
    const d = s.dissolve;
    R(dissolve, d, 'time', 0.1, 4, 0.01, '연소 (초)');
    R(dissolve, d, 'detail', 1, 60, 0.5, '노이즈 디테일');
    R(dissolve, d, 'rise', 0, 1, 0.01, '상승 대 노이즈');
    dissolve.addColor(d, 'edgeColor').name('가장자리 색상');
    R(dissolve, d, 'edgeEmissive', 0, 12, 0.01, '가장자리 발광');
    R(dissolve, d, 'edgeWidth', 0.005, 0.4, 0.005, '가장자리 폭');

    // The dark. Not quite black on purpose — see the note in settings.js.
    const dark = folder.addFolder('어둠');
    dark.addColor(s, 'color').name('몸 색상');
    R(dark, s, 'roughness', 0, 1, 0.01, '거칠기');
    R(dark, s, 'metalness', 0, 1, 0.01, '금속성');

    // The rim that draws the silhouette. `power` tightens the band toward the
    // outline; `emissive` is how hard it burns.
    const fresnel = folder.addFolder('프레넬 림');
    const fr = s.fresnel;
    fresnel.addColor(fr, 'color').name('림 라이트 색상');
    R(fresnel, fr, 'power', 0.2, 8, 0.05, '림 라이트 집중도');
    R(fresnel, fr, 'emissive', 0, 10, 0.01, '림 라이트 발광');
  }

  /**
   * The fist — `Q`, and everything that arrives with it.
   *
   * The button at the top is the one to use while tuning: it calls the whole
   * thing down on the nearest body without going through the mark, so a number
   * can be moved and seen again two seconds later. Everything below is sampled
   * every frame, so a slider moved while the fist is falling lands on the fist
   * that is falling.
   *
   * The three numbers worth reaching for first are `height` (the length of the
   * drop, and therefore its weight), `fall` (a quarter second is a punch, half
   * is a boulder) and `fist → size` — see the note in settings.js.
   */
  _buildJudgement() {
    const folder = this.gui.addFolder('심판 (주먹)');
    const j = settings.judgement;
    const R = Editor.range;

    folder
      .add({ cast: () => this.hooks.onCastJudgement?.() }, 'cast')
      .name('가장 가까운 적에게 소환');
    folder.add(j, 'enabled').name('활성화');
    R(folder, j, 'height', 1.2, 12, 0.05, '인 높이 (m)');

    // The choreography. `fall` is the only one that is about force rather than
    // pacing, and `charge` is the beat the move would be nothing without.
    const beats = folder.addFolder('박자 (초)');
    const b = j.beats;
    R(beats, b, 'open', 0.05, 2, 0.01, '인이 스스로 그려짐');
    R(beats, b, 'charge', 0, 3, 0.01, '모으는 중');
    R(beats, b, 'fall', 0.05, 1.5, 0.01, '낙하');
    R(beats, b, 'dwell', 0, 3, 0.01, '박힘');
    R(beats, b, 'withdraw', 0.05, 2, 0.01, '뒤로 당김');
    R(beats, b, 'close', 0.05, 2, 0.01, '인이 접힘');

    // Who it can be called down on. `aim` is the same control the shadows have:
    // how far off the middle of the frame a body may be and still be the one
    // meant, as a fraction of the screen's height.
    const mark = folder.addFolder('표식');
    const m = j.marking;
    R(mark, m, 'range', 4, 80, 0.5, '표시 가능 거리 (m)');
    R(mark, m, 'aim', 0.02, 0.6, 0.005, '조준 허용 (스크린)');
    R(mark, m, 'timeout', 0, 60, 0.5, '팔 만료 시간 (초)');

    // The circle. Every mark on it is arithmetic in one fragment shader, so the
    // counts below are free — turn `runes` up and there are simply more of them.
    const seal = folder.addFolder('인');
    const s = j.seal;
    R(seal, s, 'radius', 0.4, 5, 0.05, '반경 (m)');
    seal.addColor(s, 'color').name('라인 색상');
    seal.addColor(s, 'coreColor').name('코어 색상');
    R(seal, s, 'intensity', 0, 8, 0.05, '밝기');
    R(seal, s, 'spin', -2, 2, 0.01, '초당 회전 수');
    R(seal, s, 'ticks', 4, 120, 1, '틱');
    R(seal, s, 'runes', 3, 40, 1, '룬');
    R(seal, s, 'spokes', 2, 24, 1, '스포크');
    R(seal, s, 'width', 0.002, 0.06, 0.001, '선 굵기');
    R(seal, s, 'softness', 0.001, 0.06, 0.001, '페더링');
    R(seal, s, 'haze', 0, 2, 0.01, '내부 발광');
    R(seal, s, 'detail', 0, 1, 0.01, '얼룩무늬');
    R(seal, s, 'pulse', 0, 1, 0.01, '호흡 깊이');
    R(seal, s, 'pulseSpeed', 0, 20, 0.1, '호흡 속도');

    // The arm. There is no colour map on this model at all — the whole look is
    // the rim and the relief below, placed by its normal map.
    const fist = folder.addFolder('주먹');
    const f = j.fist;
    R(fist, f, 'scale', 0.4, 4, 0.01, '크기 ×');
    R(fist, f, 'crush', 0, 1.5, 0.01, '지면 위 정지 (m)');
    fist.addColor(f, 'color').name('몸 색상');
    R(fist, f, 'roughness', 0, 1, 0.01, '거칠기');
    R(fist, f, 'metalness', 0, 1, 0.01, '금속성');
    R(fist, f, 'normalScale', 0, 3, 0.01, '요철 깊이');
    R(fist, f, 'flash', 0, 10, 0.05, '접촉 섬광');
    R(fist, f, 'flashTime', 0.02, 1, 0.01, '섬광 페이드 (초)');

    const rim = fist.addFolder('프레넬 림');
    const fr = f.fresnel;
    rim.addColor(fr, 'color').name('림 라이트 색상');
    R(rim, fr, 'power', 0.2, 8, 0.05, '림 라이트 집중도');
    R(rim, fr, 'emissive', 0, 10, 0.01, '림 라이트 발광');

    // The light inside the sculpt. `gain` is the control: relief is a small
    // number and has to be opened right up before it reads at all.
    const veins = fist.addFolder('혈관 (요철 내부)');
    const v = f.veins;
    veins.addColor(v, 'color').name('차가운 색상');
    veins.addColor(v, 'hotColor').name('뜨거운 색상');
    R(veins, v, 'emissive', 0, 10, 0.01, '발광');
    R(veins, v, 'gain', 0.5, 20, 0.1, '요철 게인');
    R(veins, v, 'sharpness', 0.2, 6, 0.05, '요철 선명도');
    R(veins, v, 'scale', 0.5, 30, 0.1, '필드 스케일');
    R(veins, v, 'speed', 0, 5, 0.01, '필드 속도');
    R(veins, v, 'cavity', 0, 1, 0.01, '오목면 음영');

    const birth = fist.addFolder('인을 관통하여');
    const bl = f.birth;
    birth.addColor(bl, 'color').name('라인 색상');
    R(birth, bl, 'emissive', 0, 12, 0.05, '라인 발광');
    R(birth, bl, 'width', 0.01, 1, 0.005, '라인 폭 (m)');

    // What it does to a body. `lift` is negative here and positive on every
    // other move in the game — see the note in settings.js.
    const force = folder.addFolder('타격');
    const fo = j.force;
    R(force, fo, 'reach', 0.2, 6, 0.05, '압살 거리 (m)');
    R(force, fo, 'impulse', 0, 20, 0.1, '외향 (m/s)');
    R(force, fo, 'lift', -30, 10, 0.1, '하강 ↔ 상승 (m/s)');
    R(force, fo, 'spin', 0, 4, 0.05, '상체 분담');
    R(force, fo, 'hitStop', 0, 0.5, 0.005, '정지 (초)');
    R(force, fo, 'hitStopScale', 0.01, 1, 0.005, '동결 깊이');
    R(force, fo, 'shake', 0, 1.5, 0.01, '카메라 흔들림 (m)');

    // The ground. The cracks only open behind the wave, which is what stops the
    // pair reading as one decal fading in.
    const shock = folder.addFolder('지면');
    const sh = j.shock;
    R(shock, sh, 'radius', 0.5, 12, 0.1, '파동 도달 (m)');
    R(shock, sh, 'life', 0.1, 3, 0.01, '파동 지속 (초)');
    shock.addColor(sh, 'color').name('파동 색상');
    shock.addColor(sh, 'crackColor').name('균열 색상');
    R(shock, sh, 'intensity', 0, 8, 0.05, '밝기');
    R(shock, sh, 'width', 0.01, 0.4, 0.005, '파동 폭');
    R(shock, sh, 'softness', 0.01, 0.5, 0.005, '페더링');
    R(shock, sh, 'cracks', 0, 32, 1, '균열');
    R(shock, sh, 'crackLength', 0.1, 1, 0.01, '균열 범위');
    R(shock, sh, 'crackWidth', 0.002, 0.1, 0.001, '균열 폭');
    R(shock, sh, 'crackGlow', 0, 5, 0.05, '균열 발광');
    R(shock, sh, 'lift', 0, 0.3, 0.005, '바닥 이탈 (m)');

    // Dust and soil — the only thing in the ability that is lit rather than
    // emitted, which is exactly why it sells the impact.
    const dust = folder.addFolder('먼지와 흙');
    const d = j.dust;
    dust.add(d, 'enabled').name('활성화');
    R(dust, d, 'puffs', 0, 120, 1, '먼지 펑');
    R(dust, d, 'clods', 0, 160, 1, '흙 덩어리');
    R(dust, d, 'speed', 0.5, 20, 0.1, '발사 (m/s)');
    R(dust, d, 'spread', 0, 1.5, 0.01, '산란');
    R(dust, d, 'rise', 0, 2, 0.01, '상승 대 외향');
    R(dust, d, 'ring', 0, 3, 0.05, '탄생 반경 (m)');
    R(dust, d, 'dustLife', 0.1, 6, 0.05, '먼지 수명 (초)');
    R(dust, d, 'soilLife', 0.1, 4, 0.05, '흙 수명 (초)');
    R(dust, d, 'dustSize', 0.02, 2, 0.01, '먼지 크기 (m)');
    R(dust, d, 'dustGrow', 1, 10, 0.05, '먼지 팽창 ×');
    R(dust, d, 'soilSize', 0.005, 0.5, 0.005, '흙 크기 (m)');
    R(dust, d, 'dustDrag', 0.05, 8, 0.05, '먼지 저항 /초');
    R(dust, d, 'soilDrag', 0.05, 4, 0.01, '흙 저항 /초');
    R(dust, d, 'gravity', -40, 0, 0.5, '중력 (m/s²)');
    R(dust, d, 'lift', 0, 6, 0.05, '먼지 부력');
    dust.addColor(d, 'color').name('빛 받는 먼지');
    dust.addColor(d, 'shadeColor').name('그림자 먼지');
    dust.addColor(d, 'soilColor').name('흙');
    R(dust, d, 'opacity', 0, 1.5, 0.01, '불투명도');

    const light = folder.addFolder('그 빛');
    const l = j.light;
    light.add(l, 'enabled').name('활성화');
    light.addColor(l, 'color').name('인 색상');
    light.addColor(l, 'flashColor').name('접촉 색상');
    R(light, l, 'intensity', 0, 60, 0.5, '모으는 동안');
    R(light, l, 'flash', 0, 400, 1, '접촉 시');
    R(light, l, 'flashTime', 0.05, 2, 0.01, '섬광 페이드 (초)');
    R(light, l, 'distance', 1, 40, 0.5, '도달 거리 (m)');
    R(light, l, 'decay', 0.5, 3, 0.05, '감쇠');
  }

  /**
   * Flight, and the blades it hangs in the air — see `vfx/BladeStorm.js`.
   *
   * Three numbers before any of the others: `height` (how far off the floor the
   * body cruises, which is also how far the aim is looking down), `speed` (this
   * has to be *fast* or the whole mode reads as walking at altitude) and
   * `blades → volley → stagger`, which is the difference between six kills and
   * one event.
   */
  _buildFlight() {
    const folder = this.gui.addFolder('비행 (X)과 칼날');
    const f = settings.flight;
    const R = Editor.range;

    folder.add(f, 'enabled').name('활성화');
    R(folder, f, 'height', 1, 20, 0.1, '순항 고도 (m)');
    R(folder, f, 'speed', 1, 30, 0.1, '순항 (m/s)');
    R(folder, f, 'boost', 1, 40, 0.1, '부스트 — 이동 (m/s)');

    const air = folder.addFolder('공중');
    R(air, f, 'takeoff', 0.1, 3, 0.01, '상승 시간 (초)');
    R(air, f, 'land', 0.1, 3, 0.01, '하강 시간 (초)');
    R(air, f, 'acceleration', 1, 40, 0.5, '가속 (m/s²)');
    R(air, f, 'deceleration', 1, 40, 0.5, '감속 (m/s²)');
    // Lower is snappier: it is the fraction of the heading gap left after a
    // second, and the bank below is drawn off how fast that gap closes.
    R(air, f, 'turnRate', 0.0001, 0.2, 0.0001, '회전 (1초 후 남는 간격)');
    R(air, f, 'bank', 0, 1.5, 0.01, '회전 시 기울기 (rad)');
    R(air, f, 'pitch', 0, 1, 0.01, '속도 시 고개 숙임 (rad)');
    R(air, f, 'leanRate', 0.5, 20, 0.1, '기울기 도달 (1/s)');
    R(air, f, 'bob', 0, 1, 0.005, '호흡 부유 (m)');
    R(air, f, 'bobSpeed', 0, 4, 0.01, '호흡 속도 (Hz)');
    R(air, f, 'blendIn', 0.02, 1.5, 0.01, '포즈 페이드 인 (초)');
    R(air, f, 'blendOut', 0.02, 1.5, 0.01, '포즈 페이드 아웃 (초)');

    // The touchdown. `lead` is the only one that has to be judged against the
    // clip rather than by taste: it is how far *before* the feet arrive the
    // landing starts, so its impact frame is the frame they land on.
    const down = folder.addFolder('착지');
    const r = f.recover;
    down.add(r, 'enabled').name('착지 동작');
    R(down, r, 'lead', 0, 1, 0.01, '조기 시작 (초)');
    R(down, r, 'blendIn', 0.02, 1, 0.01, '페이드 인 (초)');
    R(down, r, 'blendOut', 0.02, 1.5, 0.01, '대기 복귀 시간 (초)');
    R(down, r, 'exitAt', 0.1, 1, 0.01, '방출 시점 (위상)');

    // The aim. One body at a time, and it re-arms itself on every click.
    const mark = folder.addFolder('표식');
    const m = f.marking;
    R(mark, m, 'range', 4, 100, 0.5, '표시 가능 거리 (m)');
    R(mark, m, 'aim', 0.02, 0.6, 0.005, '조준 허용 (스크린)');

    const blades = folder.addFolder('칼날');
    const b = f.blades;
    R(blades, b, 'max', 1, 16, 1, '유지 가능 수');
    R(blades, b, 'scale', 0.3, 3, 0.01, '크기 ×');
    R(blades, b, 'formTime', 0.05, 2, 0.01, '제련 시간 (초)');
    R(blades, b, 'chargeTime', 0.05, 4, 0.01, '충전 시간 (초)');

    // The ring itself. `spin` and `sway` are what stop six swords from reading
    // as one rigid carousel.
    const orbit = blades.addFolder('광배');
    const o = b.orbit;
    R(orbit, o, 'radius', 0.4, 6, 0.05, '반경 (m)');
    R(orbit, o, 'height', 0.2, 2.5, 0.01, '몸 위로 ×');
    R(orbit, o, 'rise', 0, 2, 0.01, '링 기울기');
    R(orbit, o, 'spin', -2, 2, 0.01, '초당 회전 수');
    R(orbit, o, 'tilt', 0, 1.5, 0.01, '칼날 외향');
    R(orbit, o, 'sway', 0, 1, 0.005, '흔들림 (m)');
    R(orbit, o, 'swaySpeed', 0, 6, 0.05, '흔들림 속도');

    // The volley. `stagger` first — see the note above.
    const volley = blades.addFolder('일제 사격');
    R(volley, b, 'stagger', 0, 0.6, 0.005, '간격 시간 (초)');
    R(volley, b, 'windUp', 0.02, 1, 0.01, '뒤로 당김 (초)');
    R(volley, b, 'windBack', 0, 3, 0.05, '뒤로 당김 (m)');
    R(volley, b, 'speed', 5, 90, 0.5, '이동 속도 (m/s)');
    R(volley, b, 'acceleration', 10, 400, 5, '가속 (m/s²)');
    R(volley, b, 'hitRadius', 0.1, 2, 0.01, '도달 거리 (m)');
    R(volley, b, 'overshoot', 0, 8, 0.05, '박힘 거리 (m)');
    R(volley, b, 'plantTime', 0.1, 6, 0.05, '지면 박힘 시간 (초)');
    R(volley, b, 'fadeTime', 0.1, 3, 0.01, '연소 소멸 시간 (초)');
    R(volley, b, 'quiver', 0, 0.4, 0.005, '링 (rad)');
    R(volley, b, 'quiverSpeed', 1, 60, 0.5, '링 속도');

    // The steel. The blade wears the weapon's own textured material and nothing
    // here replaces or dials it — the rim is the whole of what is added.
    const look = blades.addFolder('강철');
    const lk = b.look;
    R(look, lk, 'stretch', 1, 8, 0.05, '비행 중 번짐 ×');

    const rim = look.addFolder('프레넬 림');
    const fr = lk.fresnel;
    rim.addColor(fr, 'color').name('림 라이트 색상');
    R(rim, fr, 'power', 0.2, 8, 0.05, '림 라이트 집중도');
    R(rim, fr, 'emissive', 0, 10, 0.01, '림 라이트 발광');

    // What a blade does to a body. `slices` is the one that matters: it is a
    // sword, and it should take them apart.
    const force = blades.addFolder('타격');
    const fo = b.force;
    R(force, fo, 'impulse', 0, 30, 0.1, '칼날 따라 (m/s)');
    R(force, fo, 'lift', -20, 20, 0.1, '상승 (m/s)');
    R(force, fo, 'spin', 0, 4, 0.05, '상체 분담');
    R(force, fo, 'hitStop', 0, 0.4, 0.005, '정지 (초)');
    R(force, fo, 'hitStopScale', 0.01, 1, 0.005, '동결 깊이');
    R(force, fo, 'shake', 0, 1.5, 0.01, '카메라 흔들림 (m)');
    force.add(fo, 'slices').name('두 동강냄');

    // The hit: one burst and a shower of sparks out of one buffer.
    const hit = blades.addFolder('타격');
    const im = b.impact;
    hit.add(im, 'enabled').name('활성화');
    hit.addColor(im, 'color').name('섬광 색상');
    hit.addColor(im, 'ringColor').name('링 색상');
    R(hit, im, 'size', 0.2, 6, 0.05, '크기 (m)');
    R(hit, im, 'life', 0.05, 2, 0.01, '지속 (초)');
    R(hit, im, 'intensity', 0, 10, 0.05, '밝기');
    R(hit, im, 'spikes', 0, 16, 1, '별 스파이크');
    R(hit, im, 'spikeLength', 0.2, 4, 0.05, '스파이크 범위');

    const sparks = hit.addFolder('스파크');
    R(sparks, im, 'sparks', 0, 160, 1, '개수');
    sparks.addColor(im, 'sparkColor').name('색상');
    R(sparks, im, 'sparkSpeed', 0.5, 40, 0.1, '발사 (m/s)');
    R(sparks, im, 'sparkSpread', 0, 1.3, 0.01, 'cone');
    R(sparks, im, 'sparkLife', 0.05, 3, 0.01, '지속 (초)');
    R(sparks, im, 'sparkSize', 0.005, 0.4, 0.005, '크기 (m)');
    R(sparks, im, 'sparkStretch', 0, 0.3, 0.001, 'm/s 당 번짐');
    R(sparks, im, 'sparkDrag', 0.05, 8, 0.05, '저항 /초');
    R(sparks, im, 'sparkGravity', -40, 0, 0.5, '중력 (m/s²)');

    const light = blades.addFolder('그 빛');
    const li = b.light;
    light.add(li, 'enabled').name('활성화');
    light.addColor(li, 'color').name('광배 색상');
    light.addColor(li, 'flashColor').name('접촉 색상');
    R(light, li, 'intensity', 0, 60, 0.5, '모이는 동안');
    R(light, li, 'flash', 0, 300, 1, '접촉 시');
    R(light, li, 'flashTime', 0.05, 2, 0.01, '섬광 페이드 (초)');
    R(light, li, 'distance', 1, 40, 0.5, '도달 거리 (m)');
    R(light, li, 'decay', 0.5, 3, 0.05, '감쇠');
  }

  _buildPost() {
    const folder = this.gui.addFolder('후처리');
    const p = settings.post;
    const R = Editor.range;

    folder.add(p, 'enabled').name('활성화');
    // The only anti-aliasing in the project — the scene never touches the canvas
    // directly, so the renderer's own flag has nothing to act on. It is also the
    // heaviest thing in the stack, hence a dial rather than a constant.
    folder.add(p, 'samples', [0, 2, 4, 8]).name('안티앨리어싱');
    R(folder, p, 'exposure', 0.1, 3, 0.01, '노출');
    R(folder, p, 'bloomStrength', 0, 3, 0.01, '블룸 강도');
    R(folder, p, 'bloomRadius', 0, 1.5, 0.01, '블룸 반경');
    R(folder, p, 'bloomThreshold', 0, 2, 0.01, '블룸 임계값');
    R(folder, p, 'contrast', 0.5, 2, 0.01, '대비');
    R(folder, p, 'saturation', 0, 2.5, 0.01, '채도');
    R(folder, p, 'temperature', -0.5, 0.5, 0.01, '온도');
    R(folder, p, 'lift', -0.2, 0.2, 0.005, 'lift');
    R(folder, p, 'gain', 0.5, 2, 0.01, 'gain');
    R(folder, p, 'vignette', 0, 1.5, 0.01, '비네트');
    R(folder, p, 'chromaticAberration', 0, 3, 0.01, '색수차');
    R(folder, p, 'grain', 0, 0.2, 0.001, '필름 그레인');
  }

  _buildCamera() {
    const folder = this.gui.addFolder('카메라');
    const c = settings.camera;
    const R = Editor.range;

    // The wheel writes `distance` straight into settings, so the slider listens.
    R(folder, c, 'distance', 1, 40, 0.1, '거리').listen();
    R(folder, c, 'minDistance', 1, 20, 0.1, '최소 거리');
    R(folder, c, 'maxDistance', 4, 40, 0.1, '최대 거리');
    R(folder, c, 'zoomSpeed', 0.1, 3, 0.01, '줌 속도');
    R(folder, c, 'fov', 20, 90, 0.5, '시야각');
    R(folder, c, 'targetHeight', 0, 4, 0.01, '타겟 높이');
    R(folder, c, 'minPolar', 0.05, 1.5, 0.01, '최소 피치');
    // Past π/2 the camera drops below its target and the view tilts up, which is
    // the only way anything in the sky gets into frame. Nothing collides the
    // lens against the floor, so a long zoom at the top of this range will go
    // through the ground — which is why the default stops just past level.
    R(folder, c, 'maxPolar', 0.2, 2.2, 0.01, '최대 피치');
    R(folder, c, 'damping', 0.001, 0.5, 0.001, '추종 감쇠');
  }

  _buildCharacter() {
    const folder = this.gui.addFolder('캐릭터');
    const c = settings.character;
    const R = Editor.range;

    // The mixer's own rate.
    R(folder, settings.global, 'animationSpeed', 0.1, 3, 0.01, '재생 속도');
    R(folder, settings.global, 'timeScale', 0.02, 2, 0.01, '시간 배율');

    // The turntable advances `facing` itself, so that slider listens.
    R(folder, c, 'spin', -0.5, 0.5, 0.005, '턴테이블 (rev/s)');
    R(folder, c, 'facing', -Math.PI, Math.PI * 3, 0.01, '방향').listen();

    // The skin's response to the stage's lights. The body wears the glTF
    // palette's authored maps, so these two only reach it once the override is
    // on — off, they still drive any material the palette had no match for.
    const material = folder.addFolder('피부');
    material.add(c, 'overrideSurface').name('저작 PBR 덮어쓰기');
    R(material, c, 'roughness', 0, 1, 0.01, '거칠기');
    R(material, c, 'metalness', 0, 1, 0.01, '금속성');

    // The rig is re-normalised against `targetHeight` every frame, so this
    // rescales the body live — and anything attached to a bone with it.
    const rig = folder.addFolder('리그');
    R(rig, c, 'targetHeight', 1, 3, 0.01, '높이 (m)');
    R(rig, c, 'turnRate', 0.000001, 0.02, 0.000001, '회전 추종');
  }

  _buildLocomotion() {
    const folder = this.gui.addFolder('이동 동작');
    const l = settings.locomotion;
    const R = Editor.range;

    folder.add(l, 'enabled').name('조작 활성화');

    // How fast the body travels. The stride rate divides these by the clip
    // speeds below, so raising one speeds the legs up to match.
    R(folder, l, 'walkSpeed', 0.2, 4, 0.01, '걷기 (m/s)');
    R(folder, l, 'runSpeed', 1, 12, 0.01, '달리기 (m/s)');
    R(folder, l, 'acceleration', 1, 60, 0.1, '가속');
    R(folder, l, 'deceleration', 1, 60, 0.1, '감속');
    R(folder, l, 'blendRate', 0.000001, 0.05, 0.000001, '블렌드 추종');

    const gait = folder.addFolder('보행');
    R(gait, l, 'idleThreshold', 0, 0.5, 0.001, '대기 하강 속도 (m/s)');
    // The speeds the clips themselves cover at rate 1 — the divisor. Tune these
    // once against the animation; move `walkSpeed`/`runSpeed` for design.
    R(gait, l, 'clipWalkSpeed', 0.2, 4, 0.01, '걷기 클립 (m/s)');
    R(gait, l, 'clipRunSpeed', 1, 12, 0.01, '달리기 클립 (m/s)');
    // Trim on top of that division, per gait — for the part of the mismatch the
    // clip speeds do not account for. Blended between the two by the same curve
    // the weights use, and bounded by the stride clamp below.
    R(gait, l, 'walkAnimSpeed', 0.25, 3, 0.01, '걷기 애니메이션 ×');
    R(gait, l, 'runAnimSpeed', 0.25, 3, 0.01, '달리기 애니메이션 ×');
    R(gait, l, 'strideMin', 0.2, 1, 0.01, '보폭 최소');
    R(gait, l, 'strideMax', 1, 5, 0.01, '보폭 최대');

    // Space, from a run. `distance` renormalises the clip's own travel, so it is
    // the reach of the jump in metres — 0 hands it back to the animation.
    const jump = folder.addFolder('멀리뛰기');
    const j = settings.jump;
    jump.add(j, 'enabled').name('멀리뛰기 활성화');
    R(jump, j, 'distance', 0, 20, 0.1, '거리 (m)');
    R(jump, j, 'minRunFraction', 0, 1, 0.01, '달리기 대비 발사 ×');
    R(jump, j, 'landAt', 0.4, 1, 0.01, '조작 복귀 시점');
    R(jump, j, 'blendIn', 0.01, 0.6, 0.01, '블렌드 인 (초)');
    R(jump, j, 'blendOut', 0.01, 0.8, 0.01, '블렌드 아웃 (초)');

    // Space at anything less. It covers no ground of its own, so what there is
    // to tune is how it sits over the gait: `gaitBleed` is how much of the walk
    // or run keeps playing under it, which is what keeps the legs carrying the
    // body instead of planting while the controller travels.
    const hop = folder.addFolder('작은 도약');
    const h = settings.hop;
    hop.add(h, 'enabled').name('작은 도약 활성화');
    R(hop, h, 'gaitBleed', 0, 1, 0.01, '도약 시 보행');
    R(hop, h, 'landAt', 0.4, 1, 0.01, '발 내려놓는 시점');
    R(hop, h, 'blendIn', 0.01, 0.6, 0.01, '블렌드 인 (초)');
    R(hop, h, 'blendOut', 0.01, 0.8, 0.01, '블렌드 아웃 (초)');
  }

  /**
   * The kick and the bodies it lands on.
   *
   * Two halves that meet in one place. The **kick** half is the animation
   * contract: `hitAt`, `recoverAt` and `approach` are normalised times in the
   * clip, and they are the three numbers to reach for after watching the move
   * once — the foot connects here, control comes back there, and the warp has
   * that long to put the body where the animator assumed it was standing.
   *
   * The **enemies** half is the sandbox around it. Everything is live except
   * the height and the ring, which are read when a body is spawned — hit
   * "Respawn all" after moving those.
   */
  _buildCombat() {
    const folder = this.gui.addFolder('전투');
    const R = Editor.range;

    // One folder per move, built from the same three groups — the two attacks
    // are the same machine (`animation/Attack.js`) with different numbers, so
    // there is nothing to say about one of them that is not a field on both.
    this._buildAttack(folder, settings.kick, '킥 (E)');
    this._buildAttack(folder, settings.slashHit, '참격 (R)');
    this._buildAttack(folder, settings.crouchSlash, '슬라이드 베기 (T)');
    this._buildTargetRing(folder);
    this._buildSlice(folder);

    const e = settings.enemies;
    const enemies = folder.addFolder('적');
    enemies.add(e, 'enabled').name('적 활성화');
    R(enemies, e, 'count', 0, 20, 1, '동시 존재 수');
    R(enemies, e, 'radius', 2, 40, 0.5, '스폰 반경 (m)');
    R(enemies, e, 'minRadius', 1, 20, 0.5, '최소 거리 (m)');
    R(enemies, e, 'separation', 0.5, 6, 0.1, '서로 간격 (m)');
    R(enemies, e, 'height', 1, 3, 0.01, '높이 (m)');
    R(enemies, e, 'corpseTime', 0, 30, 0.5, '시체 유지 (초)');
    R(enemies, e, 'dissolveTime', 0.1, 6, 0.1, '연소 소멸 시간 (초)');
    R(enemies, e, 'respawnDelay', 0, 15, 0.1, '재스폰 시간 (초)');
    enemies.add(e, 'watch').name('플레이어 응시');
    R(enemies, e, 'watchRadius', 2, 40, 0.5, '주시 범위 (m)');
    R(enemies, e, 'turnRate', 0.000001, 0.2, 0.000001, '회전 추종');
    enemies.add(e, 'collide').name('플레이어 차단');
    R(enemies, e, 'bodyRadius', 0.1, 1.5, 0.01, '몸 반경 (m)');
    enemies
      .add({ respawn: () => this.hooks.onRespawnEnemies?.() }, 'respawn')
      .name('전부 재스폰');

    // Authored rather than imported — the export carries no textures at all.
    const look = enemies.addFolder('외형');
    const el = e.look;
    look.addColor(el, 'color').name('몸 색상');
    R(look, el, 'roughness', 0, 1, 0.01, '거칠기');
    R(look, el, 'metalness', 0, 1, 0.01, '금속성');
    look.addColor(el, 'rimColor').name('림 라이트 색상');
    R(look, el, 'rimPower', 0.2, 8, 0.05, '림 라이트 집중도');
    R(look, el, 'rimEmissive', 0, 8, 0.01, '림 라이트 발광');
    look.addColor(el, 'edgeColor').name('불태움 색상');
    R(look, el, 'edgeEmissive', 0, 20, 0.1, '연소 발광');
    R(look, el, 'edgeWidth', 0.01, 0.5, 0.01, '연소 폭');
    R(look, el, 'dissolveDetail', 1, 40, 0.5, '연소 디테일');
    R(look, el, 'dissolveRise', 0, 1, 0.01, '연소 상승');

    // The ragdoll. `brace` is the one worth understanding: bone lengths alone
    // give a rope, and these extra constraints across the pelvis and chest are
    // what give the body a shape it is trying to keep as it falls.
    const doll = enemies.addFolder('래그돌');
    const r = e.ragdoll;
    R(doll, r, 'gravity', -60, -1, 0.5, '중력 (m/s²)');
    R(doll, r, 'damping', 0, 0.9, 0.01, '공기 저항 /초');
    R(doll, r, 'iterations', 1, 20, 1, '솔버 패스');
    R(doll, r, 'substeps', 1, 6, 1, '서브 스텝');
    R(doll, r, 'brace', 0, 1, 0.01, '몸통 강성');
    R(doll, r, 'radius', 0.01, 0.4, 0.005, '관절 반경 (m)');
    R(doll, r, 'friction', 0, 1, 0.01, '지면 마찰');
    R(doll, r, 'bounce', 0, 0.8, 0.01, '반발');
    R(doll, r, 'sleep', 0, 0.5, 0.005, '아래에서 휴지');
  }

  /**
   * One melee move's three groups: who it goes to, when it lands, what it does.
   *
   * The numbers to reach for after watching a move once are the normalised
   * times — the blow connects *here*, control comes back *there*, and the warp
   * has that long to put the body where the animator assumed it was standing.
   * Everything else follows from those three.
   *
   * @param {import('lil-gui').GUI} parent
   * @param {object} config a `settings.kick`-shaped block
   * @param {string} title what the folder is called, hotkey included
   */
  _buildAttack(parent, config, title) {
    const folder = parent.addFolder(title);
    const R = Editor.range;

    folder.add(config, 'enabled').name('활성화');

    // Who the blow goes to. `range` and `cone` decide what can be locked at
    // all; `standoff` is the distance the strike is thrown from, and it is the
    // one that decides whether the foot lands on the chest or through it.
    const aim = folder.addFolder('타겟과 워프');
    R(aim, config, 'range', 0.5, 12, 0.05, '잠금 범위 (m)');
    R(aim, config, 'cone', 20, 360, 1, '잠금 콘 (°)');
    R(aim, config, 'standoff', 0.4, 2.5, 0.01, '공격 거리 (m)');
    R(aim, config, 'maxWarp', 0, 12, 0.05, '최대 진입 (m)');
    R(aim, config, 'warpAt', 0.05, 0.9, 0.01, '접근 종료 시점');
    R(aim, config, 'turnAt', 0.05, 1, 0.01, '회전 완료 시점');
    // Only the slide cut goes through the body rather than up to it, so these
    // two are on the block that asked for them rather than on every move.
    if ('passThrough' in config) {
      R(aim, config, 'passThrough', 0, 5, 0.05, '초과 거리 (m)');
      R(aim, config, 'passAt', 0.1, 1, 0.01, '패스 종료');
    }

    // The clip's own timeline. Every time here is normalised, so `timeScale`
    // rides over all of them: it changes how long the move takes without moving
    // where in it the blow lands.
    const timing = folder.addFolder('타이밍');
    R(timing, config, 'hitAt', 0.05, 0.95, 0.01, '타격 연결 시점');
    R(timing, config, 'reach', 0.5, 4, 0.05, '연결 거리 (m)');
    R(timing, config, 'recoverAt', 0.3, 1, 0.01, '조작 복귀 시점');
    if ('timeScale' in config) R(timing, config, 'timeScale', 0.25, 3, 0.01, '재생 배율 ×');
    R(timing, config, 'blendIn', 0.01, 0.6, 0.01, '블렌드 인 (초)');
    R(timing, config, 'blendOut', 0.01, 0.8, 0.01, '블렌드 아웃 (초)');

    // What the blow does. `spin` is the one with the least obvious name and the
    // most obvious effect: it is how much harder the shoulders are thrown than
    // the feet, which is the whole difference between sliding and folding.
    const impact = folder.addFolder('충격');
    R(impact, config, 'impulse', 0, 25, 0.1, '힘 (m/s)');
    R(impact, config, 'lift', 0, 15, 0.1, '양력 (m/s)');
    R(impact, config, 'spin', 0, 4, 0.05, '상체 ×');
    R(impact, config, 'hitStop', 0, 0.3, 0.005, '히트 정지 (초)');
    R(impact, config, 'hitStopScale', 0, 1, 0.01, '히트 정지 시간 ×');
    R(impact, config, 'shake', 0, 1, 0.01, '카메라 흔들림 (m)');
    // A fact about the move, not about the body it lands on — which is why it
    // is a field here and not in the enemies' block.
    if ('slices' in config) impact.add(config, 'slices').name('두 동강내기');
  }

  /**
   * The circle under a body in reach — see `vfx/TargetRings.js`.
   *
   * There is nothing here about *who* wears one: that is the two moves' own
   * lock range and cone above, and this only draws the answer. `falloff` is the
   * one to reach for — it is the exponent on the radius, so low is a glow that
   * fills the circle and high is a hard rim with nothing inside it.
   */
  _buildTargetRing(parent) {
    const folder = parent.addFolder('타겟 링');
    const R = Editor.range;
    const t = settings.targetRing;

    folder.add(t, 'enabled').name('활성화');
    folder.addColor(t, 'color').name('색상');
    R(folder, t, 'radius', 0.2, 3, 0.01, '반경 (m)');
    R(folder, t, 'falloff', 0.2, 12, 0.1, '가장자리 감쇠');
    R(folder, t, 'softness', 0.01, 0.6, 0.01, '외측 페더링');
    R(folder, t, 'intensity', 0, 6, 0.05, '밝기');
    R(folder, t, 'pulse', 0, 1, 0.01, '호흡 깊이');
    R(folder, t, 'pulseSpeed', 0, 12, 0.1, '호흡 속도');
    R(folder, t, 'lift', 0, 0.2, 0.005, '바닥 이탈 (m)');
    R(folder, t, 'fadeIn', 0.01, 1, 0.01, '페이드 인 (초)');
    R(folder, t, 'fadeOut', 0.01, 1, 0.01, '페이드 아웃 (초)');

    // The caps ride the ring's own fades, so there is nothing here but where
    // they sit and how big they are.
    const keys = folder.addFolder('머리 위 단축키 표시');
    keys.add(t.hotkeys, 'enabled').name('활성화');
    R(keys, t.hotkeys, 'lift', 0, 2, 0.01, '머리 위 (m)');
    R(keys, t.hotkeys, 'scale', 0.5, 2.5, 0.05, '크기 ×');
  }

  /**
   * The cut, the meat and the blood — see `combat/Enemy.js`.
   *
   * Everything here is live *except* the plane itself: `height` and `tilt` are
   * read once, at the moment of the blow, because a plane that moved afterwards
   * would slide up a corpse already lying in two pieces. Cut something new to
   * see those two move. Colours, the meat and the blood are all per-frame.
   *
   * The two multiplier groups are the ones worth playing with: `upper` is what
   * the top half takes of the move's own impulse, lift and spin, and `lower` is
   * what is left for a pair of legs. Give the lower half much of anything and
   * the body stops reading as cut and starts reading as two bodies that were
   * standing very close together.
   */
  _buildSlice(parent) {
    const folder = parent.addFolder('베기와 피');
    const R = Editor.range;
    const s = settings.slice;

    folder.add(s, 'enabled').name('베기 활성화');

    const plane = folder.addFolder('참격 (타격 시 표시)');
    R(plane, s, 'height', 0.1, 0.9, 0.01, '절단 위치 (× 키)');
    R(plane, s, 'tilt', 0, 60, 1, '기울기 편차 (°)');
    R(plane, s, 'separation', 0, 0.6, 0.01, '반쪽 간격 (m)');
    R(plane, s, 'split', 0, 8, 0.05, '분리 속도 (m/s)');

    const halves = folder.addFolder('각 반쪽의 역할');
    R(halves, s.upper, 'impulse', 0, 3, 0.05, '상단: 힘 ×');
    R(halves, s.upper, 'lift', 0, 3, 0.05, '상단: 양력 ×');
    R(halves, s.upper, 'spin', 0, 3, 0.05, '상단: 회전 ×');
    R(halves, s.lower, 'impulse', 0, 2, 0.01, '다리: 힘 ×');
    R(halves, s.lower, 'lift', 0, 2, 0.01, '다리: 양력 ×');
    R(halves, s.lower, 'spin', 0, 2, 0.01, '다리: 회전 ×');

    // Turn this off and the torso falls through the legs, which is the clearest
    // way to see what it is doing.
    const hit = folder.addFolder('두 반쪽의 상호작용');
    const c = s.collide;
    hit.add(c, 'enabled').name('반쪽끼리 충돌');
    R(hit, c, 'radius', 0, 0.3, 0.005, '관절 크기 (m)');
    R(hit, c, 'bounce', 0, 1, 0.01, '반발');
    R(hit, c, 'friction', 0, 1, 0.01, 'grip');
    R(hit, c, 'maxPush', 0.005, 0.3, 0.005, '프레임당 밀어내기 한도 (m)');

    // The hollow the cut opens is the material's own back faces, painted as
    // meat — there is no cap geometry anywhere in this.
    const meat = folder.addFolder('상처');
    meat.addColor(s, 'interiorColor').name('내부 색상');
    R(meat, s, 'interiorEmissive', 0, 3, 0.01, '내부 발광');
    meat.addColor(s, 'edgeColor').name('절단선 색상');
    R(meat, s, 'edgeEmissive', 0, 20, 0.1, '절단선 발광');
    R(meat, s, 'edgeWidth', 0.001, 0.08, 0.001, '절단선 폭');

    const blood = folder.addFolder('피');
    const b = s.blood;
    blood.add(b, 'enabled').name('피 활성화');
    blood.addColor(b, 'color').name('피 색상');
    R(blood, b, 'brightness', 0, 4, 0.05, '밝기');
    R(blood, b, 'burst', 0, 600, 5, '절단면 방울');
    R(blood, b, 'speed', 0, 15, 0.1, '투척 속도 (m/s)');
    R(blood, b, 'spread', 0, 2, 0.01, '스프레이 확산');
    R(blood, b, 'drip', 0, 300, 1, ' stump 드립 (/초)');
    R(blood, b, 'dripSpeed', 0, 6, 0.05, '낙하 속도 (m/s)');
    R(blood, b, 'bleedTime', 0, 8, 0.1, '출혈 시간 (초)');
    R(blood, b, 'size', 0.002, 0.15, 0.002, '방울 크기 (m)');
    R(blood, b, 'sizeVariance', 0, 1, 0.01, '크기 분산');
    R(blood, b, 'life', 0.1, 5, 0.05, '방울 수명 (초)');
    R(blood, b, 'lifeVariance', 0, 0.95, 0.01, '수명 분산');
    R(blood, b, 'gravity', -60, 0, 0.5, '중력 (m/s²)');
    R(blood, b, 'drag', 0.02, 4, 0.01, '공기 저항 /초');
    R(blood, b, 'stretch', 0, 0.4, 0.005, '동작 잔상');
    R(blood, b, 'maxStretch', 1, 20, 0.5, '잔상 상한');
    R(blood, b, 'fade', 0.02, 1, 0.01, '페이드 (× 수명)');
  }

  /**
   * The character screen's set.
   *
   * Same contract as everything above — `StudioStage` re-resolves the whole rig
   * from these fields every frame, so a slider moved with the screen open
   * re-lights it on the next one. The screen has to be up (`Tab`) to see any of
   * it; the play stage next door reads none of these.
   */
  _buildStudio() {
    const folder = this.gui.addFolder('캐릭터 화면');
    const s = settings.studio;
    const R = Editor.range;

    R(folder, s, 'turntable', -0.3, 0.3, 0.005, '턴테이블 (rev/s)').listen();

    const camera = folder.addFolder('카메라');
    R(camera, s.camera, 'fov', 15, 80, 0.5, '시야각');
    R(camera, s.camera, 'targetHeight', 0, 2.2, 0.01, '주시 거리 (m)');
    R(camera, s.camera, 'minDistance', 0.2, 3, 0.05, '최소 거리');
    R(camera, s.camera, 'maxDistance', 1, 20, 0.1, '최대 거리');
    R(camera, s.camera, 'autoOrbit', -0.2, 0.2, 0.005, '카메라 드리프트 (rev/s)');

    // Key and fill are each a spot plus a softbox at the same angle; moving the
    // angle moves both, which is what keeps them reading as one source.
    const key = folder.addFolder('키');
    const l = s.lights;
    R(key, l, 'keyIntensity', 0, 400, 1, '스팟 (cd)');
    key.addColor(l, 'keyColor').name('색상');
    R(key, l, 'keyAzimuth', 0, Math.PI * 2, 0.01, '방위각');
    R(key, l, 'keyElevation', 0.05, 1.5, 0.01, '고도');
    R(key, l, 'keyDistance', 1, 10, 0.05, '거리 (m)');
    R(key, l, 'keyAngle', 0.1, 1.4, 0.01, 'cone');
    R(key, l, 'keyPenumbra', 0, 1, 0.01, '반그림자');
    R(key, l, 'keySoftbox', 0, 20, 0.1, '소프트박스 (니트)');
    R(key, l, 'keySoftboxSize', 0.2, 8, 0.1, '소프트박스 크기 (m)');

    const fill = folder.addFolder('필');
    R(fill, l, 'fillIntensity', 0, 12, 0.05, '강도 (니트)');
    fill.addColor(l, 'fillColor').name('색상');
    R(fill, l, 'fillAzimuth', 0, Math.PI * 2, 0.01, '방위각');
    R(fill, l, 'fillElevation', 0.05, 1.5, 0.01, '고도');
    R(fill, l, 'fillDistance', 1, 10, 0.05, '거리 (m)');
    R(fill, l, 'fillSize', 0.2, 8, 0.1, '패널 크기 (m)');

    const edges = folder.addFolder('림, 키커, 머리카락');
    R(edges, l, 'rimIntensity', 0, 600, 1, '림 (cd)');
    edges.addColor(l, 'rimColor').name('림 라이트 색상');
    R(edges, l, 'rimAzimuth', 0, Math.PI * 2, 0.01, '림 라이트 방위각');
    R(edges, l, 'rimElevation', 0.05, 1.5, 0.01, '림 라이트 고도');
    R(edges, l, 'rimDistance', 1, 10, 0.05, '림 라이트 거리 (m)');
    R(edges, l, 'kickerIntensity', 0, 400, 1, '키커 (cd)');
    edges.addColor(l, 'kickerColor').name('키커 색상');
    R(edges, l, 'kickerAzimuth', 0, Math.PI * 2, 0.01, '키커 방위각');
    R(edges, l, 'kickerElevation', 0.05, 1.5, 0.01, '키커 고도');
    R(edges, l, 'kickerDistance', 1, 10, 0.05, '키커 거리 (m)');
    R(edges, l, 'topIntensity', 0, 300, 1, '머리카락 조명 (cd)');
    edges.addColor(l, 'topColor').name('머리카락 색상');

    const ambient = folder.addFolder('환경광과 그림자');
    R(ambient, l, 'ambientIntensity', 0, 1, 0.005, '환경광');
    ambient.addColor(l, 'ambientColor').name('환경광 색상');
    R(ambient, l, 'envIntensity', 0, 3, 0.01, '환경광 (IBL)');
    R(ambient, l, 'shadowRadius', 0, 12, 0.1, '그림자 부드러움');
    R(ambient, l, 'shadowBias', -0.01, 0.001, 0.0001, '그림자 바이어스');
    R(ambient, l, 'shadowNormalBias', 0, 0.1, 0.001, '노멀 바이어스');

    const stage = folder.addFolder('설정');
    const st = s.stage;
    stage.addColor(st, 'backdropTop').name('배경 상단');
    stage.addColor(st, 'backdropBottom').name('배경 하단');
    stage.addColor(st, 'backdropGlow').name('광배 색상');
    R(stage, st, 'glowStrength', 0, 3, 0.01, '광배 강도');
    R(stage, st, 'glowSpread', 0, 1, 0.01, '광배 확산');
    stage.addColor(st, 'floorColor').name('바닥 색상');
    R(stage, st, 'floorRoughness', 0.02, 1, 0.01, '바닥 거칠기');
    R(stage, st, 'floorMetalness', 0, 1, 0.01, '바닥 금속성');
    R(stage, st, 'floorRadius', 1, 8, 0.05, '대좌 반경 (m)');
    stage.addColor(st, 'ringColor').name('링 색상');
    R(stage, st, 'ringIntensity', 0, 6, 0.01, '링 강도');
    R(stage, st, 'contactShadow', 0, 2, 0.01, '접촉 그림자');
    R(stage, st, 'dust', 0, 3, 0.01, '스튜디오 헤이즈');

    const post = folder.addFolder('등급');
    const p = s.post;
    post.add(p, 'enabled').name('활성화');
    R(post, p, 'exposure', 0.1, 3, 0.01, '노출');
    R(post, p, 'bloomStrength', 0, 3, 0.01, '블룸 강도');
    R(post, p, 'bloomRadius', 0, 1.5, 0.01, '블룸 반경');
    R(post, p, 'bloomThreshold', 0, 2, 0.01, '블룸 임계값');
    R(post, p, 'contrast', 0.5, 2, 0.01, '대비');
    R(post, p, 'saturation', 0, 2.5, 0.01, '채도');
    R(post, p, 'temperature', -0.5, 0.5, 0.01, '온도');
    R(post, p, 'vignette', 0, 1.5, 0.01, '비네트');
    R(post, p, 'chromaticAberration', 0, 3, 0.01, '색수차');
    R(post, p, 'grain', 0, 0.2, 0.001, '필름 그레인');
  }

  dispose() {
    this.gui.destroy();
  }
}
