/**
 * What the player can *do*, in one list.
 *
 * Three things read this and nothing else describes a move: `core/Input.js`
 * builds its key map from the entries marked `attack` (so a rebind here rebinds
 * the game), `ui/ActionHUD.js` draws the panels along the bottom of the screen
 * from all of them, and `core/App.js` resolves a state per `id` each frame.
 *
 * `id` is the contract between the three. For an attack it is also the
 * `configKey` its `Attack` instance reads out of `config/settings.js` — one
 * word that names the clip, its tuning block, its glyph in `ui/icons.js` and
 * its chip in the HUD.
 *
 * `category` is the second contract, and it is a statement about *kind*, not
 * about layout: a technique is something the body does with the sword and the
 * feet, an ability is something rarer that the body alone could not. The HUD
 * gives each kind its own panel and its own shape on screen so the difference
 * is visible before either is read — see `ui/ActionHUD.js`.
 */

/**
 * @typedef {object} Category
 * @property {string} id matches an ability's `category`
 * @property {string} label the panel's heading
 * @property {string} kanji the mark beside it
 * @property {'top'|'main'} row which band of the HUD the panel sits in
 */

/**
 * The kinds of thing a move can be, in the order their panels are laid out.
 *
 * @type {Record<string, Category>}
 */
export const CATEGORIES = {
  /**
   * Getting somewhere, and getting dressed. Quiet, above the rest — neither is
   * a way to hurt anyone, and neither should compete with the panels that are.
   */
  movement: { id: 'movement', label: '이동', kanji: '歩', row: 'top' },
  /** Sword and body. The three the fight is actually fought with. */
  technique: { id: 'technique', label: '기술', kanji: '技', row: 'main' },
  /** The rarer things. Both of them are aimed by marking a body first. */
  ability: { id: 'ability', label: '술법', kanji: '術', row: 'main' }
};

/**
 * @typedef {object} Ability
 * @property {string} id matches the settings block, the `Attack` config key and the icon
 * @property {keyof typeof CATEGORIES} category which panel it is drawn in
 * @property {string} label what the chip says
 * @property {string} hotkey what the chip's key cap says
 * @property {string} code the physical `KeyboardEvent.code` behind it
 * @property {string} note one line, for the chip's tooltip
 * @property {boolean} [attack] buffered as an edge and routed to an `Attack`
 */

/** @type {Ability[]} */
export const ABILITIES = [
  {
    id: 'leap',
    category: 'movement',
    label: '도약',
    hotkey: 'Space',
    code: 'Space',
    note: '달리며 멀리 뛰어오릅니다. 더 느린 속도에서는 작은 도약이 됩니다.'
  },
  {
    id: 'customize',
    category: 'movement',
    label: '캐릭터',
    hotkey: 'Tab',
    code: 'Tab',
    note: '장비 스튜디오: 몸을 살펴보고 의상을 입히는 전용 무대입니다.'
  },
  {
    id: 'kick',
    category: 'technique',
    label: '킥',
    hotkey: 'E',
    code: 'KeyE',
    note: '가장 가까운 적에게 올라타 발을 박아넣습니다.',
    attack: true
  },
  {
    id: 'slashHit',
    category: 'technique',
    label: '참격',
    hotkey: 'R',
    code: 'KeyR',
    note: '접근하여 허리를 가로지르게 베어 엽니다. 사거리가 길고 실제로 베입니다.',
    attack: true
  },
  {
    id: 'crouchSlash',
    category: 'technique',
    label: '슬라이드 베기',
    hotkey: 'T',
    code: 'KeyT',
    note: '달려가다가 미끄러져 내려앉으며 지나가는 길에 베어 엽니다.',
    attack: true
  },
  {
    id: 'shadows',
    category: 'ability',
    label: '그림자',
    hotkey: 'V',
    code: 'KeyV',
    note: '두 적을 바라보고 클릭해 표시하세요. 각각 당신의 그림자가 달려갑니다.'
  },
  {
    id: 'judgement',
    category: 'ability',
    label: '심판',
    hotkey: 'C',
    code: 'KeyC',
    note: '적 한 명을 표시하세요. 머리 위에 인이 펼쳐지고 주먹이 내려꽂힙니다.'
  },
  {
    id: 'flight',
    category: 'ability',
    label: '비행',
    hotkey: 'X',
    code: 'KeyX',
    note:
      '지면에서 벗어나세요. 적을 클릭해 각각 칼날을 만들고, Space로 발사합니다 — ' +
      '공중에 떠 있는 동안에는 다른 조작이 동작하지 않습니다.'
  }
];

/** The attacks, in the order a press is offered to them. */
export const ATTACK_ABILITIES = ABILITIES.filter((ability) => ability.attack);
