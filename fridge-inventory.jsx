import { useState, useEffect, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "veggie",    label: "野菜・果物",  emoji: "🥦", color: "#4caf6e" },
  { id: "meat",      label: "肉・魚",      emoji: "🥩", color: "#e57373" },
  { id: "dairy",     label: "乳製品・卵",  emoji: "🥛", color: "#f0c040" },
  { id: "drink",     label: "飲み物",      emoji: "🧃", color: "#64b5f6" },
  { id: "seasoning", label: "調味料",      emoji: "🧂", color: "#ce93d8" },
  { id: "other",     label: "その他",      emoji: "📦", color: "#b0bec5" },
];

const AREAS = [
  { id: "top",    label: "上段", emoji: "⬆️", color: "#5c6bc0" },
  { id: "middle", label: "中段", emoji: "➡️", color: "#26a69a" },
  { id: "bottom", label: "下段", emoji: "⬇️", color: "#8d6e63" },
  { id: "none",   label: "未設定", emoji: "❓", color: "#9e9e9e" },
];

const UNITS = ["個", "本", "袋", "パック", "g", "kg", "ml", "L", "枚", "切れ"];

const STORAGE_KEYS = {
  inventory: "fridge-inventory-v2",
  shopping:  "fridge-shopping-v2",
  outOfStock: "fridge-oos-v1",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const urgencyLevel = (expDate) => {
  if (!expDate) return "none";
  const diff = Math.ceil((new Date(expDate) - new Date()) / 86400000);
  if (diff < 0) return "expired";
  if (diff <= 2) return "urgent";
  if (diff <= 5) return "soon";
  return "ok";
};

const urgencyStyles = {
  expired: { bg: "#ffebee", border: "#ef9a9a", badge: "#c62828", label: "期限切れ" },
  urgent:  { bg: "#fff3e0", border: "#ffcc80", badge: "#e65100", label: "要注意" },
  soon:    { bg: "#fffde7", border: "#fff176", badge: "#f57f17", label: "まもなく" },
  ok:      { bg: "#f1f8e9", border: "#c5e1a5", badge: "#33691e", label: "新鮮" },
  none:    { bg: "#fafafa", border: "#e0e0e0", badge: "#9e9e9e", label: "期限なし" },
};

function load(key) {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

// ─── ローカル分類エンジン（APIなし・キーワードマッチング）────────────────────

const CATEGORY_KEYWORDS = {
  veggie:    ["キャベツ","にんじん","人参","大根","玉ねぎ","玉葱","ネギ","ねぎ","ほうれん草","ブロッコリー","トマト","きゅうり","なす","ピーマン","じゃがいも","さつまいも","れんこん","ごぼう","かぼちゃ","もやし","しめじ","えのき","しいたけ","エリンギ","きのこ","レタス","白菜","チンゲン菜","小松菜","春菊","セロリ","パプリカ","アボカド","りんご","バナナ","みかん","オレンジ","ぶどう","いちご","梨","桃","スイカ","メロン","レモン","グレープフルーツ","キウイ","柿","さくらんぼ","ブルーベリー","マンゴー","パイナップル","野菜","果物","フルーツ","サラダ","葉物"],
  meat:      ["鶏肉","とり肉","チキン","鶏もも","鶏むね","ささみ","豚肉","ぶた肉","豚バラ","豚ロース","豚こま","牛肉","うし肉","牛バラ","牛ロース","ひき肉","挽き肉","ベーコン","ハム","ソーセージ","ウインナー","サーモン","鮭","さば","サバ","マグロ","まぐろ","タコ","たこ","イカ","いか","エビ","えび","カニ","かに","アジ","いわし","ぶり","さんま","ホタテ","はまぐり","あさり","刺身","魚","肉","シーフード","海鮮"],
  dairy:     ["牛乳","ミルク","豆乳","チーズ","ヨーグルト","バター","生クリーム","クリーム","卵","たまご","タマゴ","アイス","アイスクリーム","乳","チョコ","プリン","ゼリー"],
  drink:     ["水","ミネラルウォーター","お茶","緑茶","麦茶","コーヒー","紅茶","ジュース","コーラ","サイダー","炭酸","ビール","ワイン","日本酒","焼酎","缶","ペットボトル","スポーツドリンク","ポカリ","アクエリアス","ほうじ茶","ウーロン茶","オレンジジュース","りんごジュース","飲み物","ドリンク","カルピス","ヤクルト"],
  seasoning: ["醤油","しょうゆ","味噌","みそ","塩","砂糖","さとう","酢","みりん","酒","料理酒","油","サラダ油","ごま油","オリーブオイル","ケチャップ","マヨネーズ","ソース","ドレッシング","コショウ","胡椒","わさび","からし","にんにく","ショウガ","生姜","スパイス","だし","出汁","めんつゆ","ポン酢","バルサミコ","調味料","香辛料","コンソメ","鶏がらスープ"],
};

const AREA_KEYWORDS = {
  top:    ["上段","上","作り置き","残り物","残り","開封済み","昨日","おかず","残","タッパー","保存容器"],
  middle: ["中段","中","なか","真ん中"],
  bottom: ["下段","下","した","野菜室","チルド","チルド室"],
};

const UNIT_PATTERNS = [
  { re: /(\d+(?:\.\d+)?)\s*(kg|キロ)/,   unit: "kg" },
  { re: /(\d+(?:\.\d+)?)\s*(g|グラム)/,  unit: "g" },
  { re: /(\d+(?:\.\d+)?)\s*(L|リットル)/,unit: "L" },
  { re: /(\d+(?:\.\d+)?)\s*(ml|ミリ)/,   unit: "ml" },
  { re: /(\d+(?:\.\d+)?)\s*(パック|pack)/,unit: "パック" },
  { re: /(\d+(?:\.\d+)?)\s*(袋|ふくろ)/, unit: "袋" },
  { re: /(\d+(?:\.\d+)?)\s*(枚|まい)/,   unit: "枚" },
  { re: /(\d+(?:\.\d+)?)\s*(切れ)/,      unit: "切れ" },
  { re: /(\d+(?:\.\d+)?)\s*(本|ほん)/,   unit: "本" },
  { re: /(\d+(?:\.\d+)?)\s*(個|こ)/,     unit: "個" },
  { re: /(\d+)/,                          unit: "個" }, // fallback
];

// 食材名からカテゴリを推測
function guessCategory(name) {
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some(w => name.includes(w))) return cat;
  }
  return "other";
}

// 食材名からエリアを推測（カテゴリをヒントに）
function guessArea(name, category, contextText) {
  // コンテキスト全体でエリアキーワードを探す
  for (const [area, words] of Object.entries(AREA_KEYWORDS)) {
    if (words.some(w => contextText.includes(w))) return area;
  }
  // カテゴリから推測
  if (category === "veggie") return "bottom";
  if (category === "meat" || category === "dairy") return "middle";
  if (category === "drink") return "middle";
  return "none";
}

// 数量と単位を文字列から抽出
function guessQuantityUnit(token) {
  for (const { re, unit } of UNIT_PATTERNS) {
    const m = token.match(re);
    if (m) return { quantity: parseFloat(m[1]), unit };
  }
  return { quantity: 1, unit: "個" };
}

// テキストを食材トークンに分割（読点・改行・スペース区切り）
function tokenize(text) {
  return text
    .split(/[、。,，\n\r・\s]+/)
    .map(t => t.trim())
    .filter(t => t.length > 0);
}

// メインパーサー：テキスト → アイテム配列
function parseItemsFromText(text) {
  const tokens = tokenize(text);
  return tokens.map(token => {
    // 数量・単位を抽出してから食材名を取り出す
    const { quantity, unit } = guessQuantityUnit(token);
    // 数字・単位を除いた名前部分
    const name = token
      .replace(/\d+(?:\.\d+)?\s*(kg|キロ|g|グラム|L|リットル|ml|ミリ|パック|pack|袋|ふくろ|枚|まい|切れ|本|ほん|個|こ)/g, "")
      .replace(/\d+/g, "")
      .trim();
    if (!name) return null;
    const category = guessCategory(name);
    const area = guessArea(name, category, text);
    return { name, category, area, quantity, unit, memo: "" };
  }).filter(Boolean);
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("inventory");
  const [items, setItems] = useState(() => load(STORAGE_KEYS.inventory));
  const [shopItems, setShopItems] = useState(() => load(STORAGE_KEYS.shopping));
  const [oosItems, setOosItems] = useState(() => load(STORAGE_KEYS.outOfStock));

  useEffect(() => { save(STORAGE_KEYS.inventory, items); }, [items]);
  useEffect(() => { save(STORAGE_KEYS.shopping, shopItems); }, [shopItems]);
  useEffect(() => { save(STORAGE_KEYS.outOfStock, oosItems); }, [oosItems]);

  const expiryCount = items.filter(i => { const u = urgencyLevel(i.expDate); return u === "expired" || u === "urgent"; }).length;
  const shopCount = shopItems.filter(i => !i.bought).length;
  const oosCount = oosItems.length;

  const TABS = [
    { id: "inventory", label: "🏠 在庫管理" },
    { id: "oos",       label: "📭 欠品リスト" },
    { id: "shopping",  label: "🛒 買い物" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #e8f5e9 0%, #f1f8e9 45%, #e3f2fd 100%)",
      fontFamily: "'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif",
      paddingBottom: 80,
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #1b5e20, #2e7d32)",
        padding: "18px 20px 0",
        boxShadow: "0 4px 20px rgba(27,94,32,0.35)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 26 }}>🧊</span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px" }}>れいぞうこ管理</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>
                在庫 {items.length}品　
                {expiryCount > 0 && <span style={{ color: "#ff8a80", fontWeight: 700 }}>⚠️ {expiryCount}品 要確認　</span>}
                {oosCount > 0 && <span style={{ color: "#ffcc80", fontWeight: 700 }}>📭 欠品 {oosCount}件　</span>}
                買い物 {shopCount}件
              </div>
            </div>
          </div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 0 }}>
            {TABS.map(t => {
              const badge = t.id === "oos" ? oosCount : t.id === "shopping" ? shopCount : 0;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
                  background: tab === t.id ? "#fff" : "transparent",
                  color: tab === t.id ? "#1b5e20" : "rgba(255,255,255,0.75)",
                  fontWeight: tab === t.id ? 800 : 500,
                  fontSize: 13,
                  borderRadius: tab === t.id ? "12px 12px 0 0" : 0,
                  transition: "all 0.2s",
                }}>
                  {t.label}
                  {badge > 0 && (
                    <span style={{ marginLeft: 5, background: t.id === "oos" ? "#ff8f00" : "#ff5252", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 800 }}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 14px 0" }}>
        {tab === "inventory" && <InventoryTab items={items} setItems={setItems} oosItems={oosItems} setOosItems={setOosItems} />}
        {tab === "oos"       && <OosTab items={oosItems} setItems={setOosItems} shopItems={shopItems} setShopItems={setShopItems} />}
        {tab === "shopping"  && <ShoppingTab items={shopItems} setItems={setShopItems} inventoryItems={items} setInventoryItems={setItems} />}
      </div>
    </div>
  );
}

// ─── Inventory Tab ────────────────────────────────────────────────────────────
function InventoryTab({ items, setItems, oosItems, setOosItems }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [filterCat, setFilterCat] = useState("all");
  const [filterArea, setFilterArea] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("added");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [aiError, setAiError] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [addedItems, setAddedItems] = useState([]);

  const emptyForm = { name: "", category: "veggie", area: "none", quantity: 1, unit: "個", expDate: "", memo: "" };
  const [form, setForm] = useState(emptyForm);

  const handleAiAdd = () => {
    if (!aiInput.trim()) return;
    setAiError(""); setAddedItems([]);
    const results = parseItemsFromText(aiInput);
    if (results.length === 0) { setAiError("食材を認識できませんでした。読点（、）で区切って入力してみてください。"); return; }
    const now = new Date().toISOString();
    const newItems = results.map(r => ({ ...r, id: Date.now() + Math.random(), addedAt: now }));
    setItems(prev => [...newItems, ...prev]);
    setAddedItems(newItems);
    setAiInput("");
  };

  const openAdd = () => { setForm(emptyForm); setEditId(null); setShowForm(true); };
  const openEdit = (item) => {
    setForm({ name: item.name, category: item.category, area: item.area || "none", quantity: item.quantity, unit: item.unit, expDate: item.expDate || "", memo: item.memo || "" });
    setEditId(item.id); setShowForm(true);
  };
  const handleSubmit = () => {
    if (!form.name.trim()) return;
    if (editId) {
      setItems(prev => prev.map(i => i.id === editId ? { ...i, ...form } : i));
    } else {
      setItems(prev => [...prev, { ...form, id: Date.now(), addedAt: new Date().toISOString() }]);
    }
    setShowForm(false); setEditId(null);
  };
  const deleteItem = (id) => setItems(prev => prev.filter(i => i.id !== id));
  const incrementQty = (id, d) => {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const next = Math.max(0, i.quantity + d);
      if (next === 0 && d < 0) {
        // 欠品リストに追加（重複なし）
        setOosItems(oos => {
          if (oos.find(o => o.name === i.name)) return oos;
          return [...oos, { id: Date.now(), name: i.name, category: i.category, unit: i.unit, oosAt: new Date().toISOString() }];
        });
      }
      return { ...i, quantity: next };
    }));
  };

  const filtered = items
    .filter(i => filterCat === "all" || i.category === filterCat)
    .filter(i => filterArea === "all" || (i.area || "none") === filterArea)
    .filter(i => {
      if (filterStatus === "all") return true;
      const u = urgencyLevel(i.expDate);
      if (filterStatus === "expired") return u === "expired";
      if (filterStatus === "soon") return u === "urgent" || u === "soon";
      return u === "ok" || u === "none";
    })
    .filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "added") return new Date(b.addedAt) - new Date(a.addedAt);
      if (sortBy === "expiry") { if (!a.expDate && !b.expDate) return 0; if (!a.expDate) return 1; if (!b.expDate) return -1; return new Date(a.expDate) - new Date(b.expDate); }
      if (sortBy === "name") return a.name.localeCompare(b.name, "ja");
      return 0;
    });

  return (
    <>
      {/* Search bar */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="食材を検索..."
          style={{ width: "100%", boxSizing: "border-box", padding: "10px 16px 10px 38px", borderRadius: 20, border: "1.5px solid #c8e6c9", fontSize: 14, background: "#fff", outline: "none" }} />
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>🔍</span>
      </div>

      {/* AI Text Input */}
      <div style={{ background: "#fff", borderRadius: 16, padding: "14px", marginBottom: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.07)", border: "1.5px solid #c8e6c9" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#2e7d32", marginBottom: 8 }}>📝 テキスト入力で自動追加 — カテゴリ・エリアをキーワードで自動判定</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={aiInput}
            onChange={e => setAiInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleAiAdd()}
            placeholder="例: 牛乳2本、にんじん3個、鶏もも肉500g"
            style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: "1.5px solid #e0e0e0", fontSize: 13, outline: "none", background: "#fafafa" }}
          />
          <button onClick={handleAiAdd} disabled={!aiInput.trim()} style={primaryBtn("#1565c0", !aiInput.trim())}>
            追加
          </button>
        </div>
        {aiError && <div style={{ marginTop: 8, fontSize: 12, color: "#c62828" }}>⚠️ {aiError}</div>}
        {addedItems.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#388e3c" }}>✅ {addedItems.length}品を追加しました</div>
            {addedItems.map((it, i) => {
              const cat = CATEGORIES.find(c => c.id === it.category) || CATEGORIES[5];
              const area = AREAS.find(a => a.id === it.area) || AREAS[3];
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, background: "#f1f8e9", borderRadius: 8, padding: "5px 10px" }}>
                  <span>{cat.emoji}</span>
                  <span style={{ fontWeight: 700 }}>{it.name}</span>
                  <span style={{ color: "#78909c" }}>{it.quantity}{it.unit}</span>
                  <span style={{ marginLeft: "auto", background: cat.color + "22", color: cat.color, borderRadius: 6, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{cat.label}</span>
                  <span style={{ background: area.color + "22", color: area.color, borderRadius: 6, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{area.emoji}{area.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <button onClick={openAdd} style={primaryBtn("#2e7d32")}>＋ 手動追加</button>
        <button onClick={() => setViewMode(v => v === "list" ? "area" : "list")}
          style={{ marginLeft: "auto", ...chipStyle(viewMode === "area", "#546e7a") }}>
          {viewMode === "area" ? "📋 リスト" : "🧊 エリア"}
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none", marginBottom: 8 }}>
        <button onClick={() => setFilterCat("all")} style={chipStyle(filterCat === "all", "#2e7d32")}>🏠 全て</button>
        {CATEGORIES.map(c => <button key={c.id} onClick={() => setFilterCat(c.id)} style={chipStyle(filterCat === c.id, c.color)}>{c.emoji} {c.label}</button>)}
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none", marginBottom: 8 }}>
        <button onClick={() => setFilterArea("all")} style={chipStyle(filterArea === "all", "#455a64")}>📦 全エリア</button>
        {AREAS.map(a => <button key={a.id} onClick={() => setFilterArea(a.id)} style={chipStyle(filterArea === a.id, a.color)}>{a.emoji} {a.label}</button>)}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
        {["all","expired","soon","ok"].map(s => {
          const labels = { all: "全状態", expired: "期限切れ", soon: "まもなく", ok: "新鮮" };
          return <button key={s} onClick={() => setFilterStatus(s)} style={{ ...chipStyle(filterStatus === s, "#546e7a"), fontSize: 11, padding: "4px 10px" }}>{labels[s]}</button>;
        })}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "#78909c" }}>並び:</span>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ fontSize: 12, border: "1px solid #b0bec5", borderRadius: 8, padding: "3px 6px", background: "#fff" }}>
            <option value="added">追加順</option>
            <option value="expiry">期限順</option>
            <option value="name">名前順</option>
          </select>
        </div>
      </div>

      {/* Items */}
      {viewMode === "area"
        ? <AreaView items={filtered} onEdit={openEdit} onDelete={deleteItem} onIncrement={incrementQty}
            onMoveArea={(id, areaId) => setItems(prev => prev.map(i => i.id === id ? { ...i, area: areaId } : i))} />
        : <ListView items={filtered} onEdit={openEdit} onDelete={deleteItem} onIncrement={incrementQty} />
      }

      {/* Form Modal */}
      {showForm && (
        <FormModal
          title={editId ? "✏️ 食材を編集" : "➕ 食材を追加"}
          form={form} setForm={setForm}
          onClose={() => setShowForm(false)}
          onSubmit={handleSubmit}
          submitLabel={editId ? "更新する" : "追加する"}
          showArea
        />
      )}
    </>
  );
}

// ─── Out-of-Stock Tab ─────────────────────────────────────────────────────────
function OosTab({ items, setItems, shopItems, setShopItems }) {
  const addToShopping = (oos) => {
    setShopItems(prev => {
      const exists = prev.find(s => s.name === oos.name && !s.bought);
      if (exists) return prev.map(s => s.id === exists.id ? { ...s, quantity: s.quantity + 1 } : s);
      return [...prev, { id: Date.now(), name: oos.name, category: oos.category, quantity: 1, unit: oos.unit, memo: "", addedAt: new Date().toISOString(), bought: false }];
    });
    setItems(prev => prev.filter(i => i.id !== oos.id));
  };

  const dismiss = (id) => setItems(prev => prev.filter(i => i.id !== id));
  const clearAll = () => setItems([]);

  if (items.length === 0) return (
    <div style={{ textAlign: "center", padding: "60px 24px", color: "#90a4ae", background: "#fff", borderRadius: 16, border: "2px dashed #cfd8dc" }}>
      <div style={{ fontSize: 48 }}>✅</div>
      <div style={{ fontWeight: 700, fontSize: 16, marginTop: 10, color: "#546e7a" }}>欠品なし</div>
      <div style={{ fontSize: 13, marginTop: 6 }}>在庫が0になった食材がここに表示されます</div>
    </div>
  );

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#e65100" }}>📭 欠品中 {items.length}品</div>
        <button onClick={clearAll} style={{ fontSize: 12, color: "#90a4ae", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
          すべて消去
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map(oos => {
          const cat = CATEGORIES.find(c => c.id === oos.category) || CATEGORIES[5];
          const alreadyInCart = shopItems.some(s => s.name === oos.name && !s.bought);
          const oosDate = new Date(oos.oosAt);
          const daysAgo = Math.floor((Date.now() - oosDate) / 86400000);
          const dateLabel = daysAgo === 0 ? "今日" : daysAgo === 1 ? "昨日" : `${daysAgo}日前`;

          return (
            <div key={oos.id} style={{
              background: "#fff8f0", border: "1.5px solid #ffcc80",
              borderRadius: 16, padding: "14px 16px",
              display: "flex", alignItems: "center", gap: 12,
              boxShadow: "0 2px 8px rgba(255,152,0,0.1)",
            }}>
              {/* Icon */}
              <div style={{ width: 44, height: 44, borderRadius: 12, background: cat.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                {cat.emoji}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#263238" }}>{oos.name}</div>
                <div style={{ fontSize: 11, color: "#90a4ae", marginTop: 2 }}>
                  {cat.label}　欠品: {dateLabel}
                  {alreadyInCart && <span style={{ marginLeft: 8, color: "#1565c0", fontWeight: 700 }}>🛒 買い物リスト済み</span>}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }}>
                <button
                  onClick={() => addToShopping(oos)}
                  disabled={alreadyInCart}
                  style={{
                    padding: "6px 12px", borderRadius: 10, border: "none",
                    background: alreadyInCart ? "#e0e0e0" : "linear-gradient(135deg, #1565c0, #1976d2)",
                    color: alreadyInCart ? "#9e9e9e" : "#fff",
                    fontSize: 12, fontWeight: 800, cursor: alreadyInCart ? "default" : "pointer",
                    boxShadow: alreadyInCart ? "none" : "0 2px 8px rgba(21,101,192,0.3)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {alreadyInCart ? "追加済み" : "🛒 買い物へ"}
                </button>
                <button
                  onClick={() => dismiss(oos.id)}
                  style={{ padding: "5px 12px", borderRadius: 10, border: "1.5px solid #e0e0e0", background: "#fafafa", color: "#90a4ae", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                >
                  消去
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── Area View（ドラッグ＆ドロップ対応）────────────────────────────────────────
function AreaView({ items, onEdit, onDelete, onIncrement, onMoveArea }) {
  const [draggingId, setDraggingId] = useState(null);   // ドラッグ中のアイテムID
  const [overArea, setOverArea]     = useState(null);   // ホバー中のエリアID
  const [ghost, setGhost]           = useState(null);   // {x, y, item} ゴーストカード位置
  const dragRef = useRef(null);                   // ドラッグ情報

  // ── ポインターイベントハンドラ ─────────────────────────────────────────────
  const onPointerDown = (e, item) => {
    // ボタン類はドラッグしない
    if (e.target.closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id: item.id, startX: e.clientX, startY: e.clientY, moved: false };
    setDraggingId(item.id);
    setGhost({ x: e.clientX, y: e.clientY, item });
  };

  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    dragRef.current.moved = true;
    setGhost(g => g ? { ...g, x: e.clientX, y: e.clientY } : null);

    // 指の下にあるエリアコンテナを特定
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const zone = el?.closest("[data-area-drop]");
    setOverArea(zone ? zone.dataset.areaDrop : null);
  };

  const onPointerUp = (e) => {
    if (!dragRef.current) return;
    const { id, moved } = dragRef.current;
    dragRef.current = null;

    if (moved && overArea) {
      onMoveArea(id, overArea);
    }
    setDraggingId(null);
    setOverArea(null);
    setGhost(null);
  };

  const draggingItem = items.find(i => i.id === draggingId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, userSelect: "none" }}>
      {/* 操作ヒント */}
      <div style={{ fontSize: 11, color: "#90a4ae", textAlign: "center", padding: "4px 0" }}>
        🤏 食材を長押し→ドラッグで別エリアへ移動
      </div>

      {AREAS.map(area => {
        const areaItems = items.filter(i => (i.area || "none") === area.id);
        const isOver = overArea === area.id;

        return (
          <div
            key={area.id}
            data-area-drop={area.id}
            style={{
              background: isOver ? area.color + "18" : "#fff",
              borderRadius: 18, overflow: "hidden",
              boxShadow: isOver
                ? `0 0 0 2.5px ${area.color}, 0 4px 20px ${area.color}44`
                : "0 2px 12px rgba(0,0,0,0.07)",
              transition: "box-shadow 0.15s, background 0.15s",
            }}
          >
            {/* エリアヘッダー */}
            <div style={{
              background: isOver
                ? area.color
                : `linear-gradient(135deg, ${area.color}ee, ${area.color}bb)`,
              padding: "10px 16px", display: "flex", alignItems: "center", gap: 8,
              transition: "background 0.15s",
            }}>
              <span style={{ fontSize: 16 }}>{area.emoji}</span>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>{area.label}</span>
              {isOver && draggingItem && (
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>
                  ← ここへ移動
                </span>
              )}
              <span style={{ marginLeft: "auto", background: "rgba(255,255,255,0.25)", color: "#fff", borderRadius: 10, padding: "1px 8px", fontSize: 12, fontWeight: 700 }}>
                {areaItems.length}品
              </span>
            </div>

            {/* アイテム一覧 */}
            <div style={{ padding: areaItems.length === 0 ? "0" : "8px 10px", display: "flex", flexDirection: "column", gap: 6, minHeight: 48 }}>
              {areaItems.length === 0 ? (
                <div style={{
                  padding: "14px 16px", color: isOver ? area.color : "#b0bec5",
                  fontSize: 13, textAlign: "center", fontWeight: isOver ? 700 : 400,
                  transition: "color 0.15s",
                }}>
                  {isOver ? "ここにドロップ" : "食材なし"}
                </div>
              ) : (
                areaItems.map(item => (
                  <DraggableItemCard
                    key={item.id}
                    item={item}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onIncrement={onIncrement}
                    isDragging={draggingId === item.id}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}

      {/* ゴーストカード（指に追従） */}
      {ghost && draggingItem && (
        <DragGhost item={draggingItem} x={ghost.x} y={ghost.y} />
      )}
    </div>
  );
}

// ドラッグ可能なカード
function DraggableItemCard({ item, onEdit, onDelete, onIncrement, isDragging, onPointerDown, onPointerMove, onPointerUp }) {
  const cat = CATEGORIES.find(c => c.id === item.category) || CATEGORIES[5];
  const urgency = urgencyLevel(item.expDate);
  const us = urgencyStyles[urgency];

  return (
    <div
      onPointerDown={e => onPointerDown(e, item)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        background: isDragging ? "#e3f2fd" : us.bg,
        border: `1.5px solid ${isDragging ? "#90caf9" : us.border}`,
        borderRadius: 12, padding: "10px 12px",
        display: "flex", alignItems: "center", gap: 10,
        opacity: isDragging ? 0.4 : 1,
        transform: isDragging ? "scale(0.97)" : "scale(1)",
        transition: "opacity 0.15s, transform 0.15s, background 0.15s",
        cursor: "grab", touchAction: "none",
        boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
      }}
    >
      {/* ドラッグハンドル */}
      <span style={{ fontSize: 14, color: "#b0bec5", flexShrink: 0, cursor: "grab" }}>⠿</span>

      <div style={{ width: 34, height: 34, borderRadius: 9, background: cat.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
        {cat.emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#263238" }}>{item.name}</span>
          {urgency !== "none" && <span style={{ background: us.badge, color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 6, padding: "1px 5px" }}>{us.label}</span>}
        </div>
        {item.memo && <div style={{ fontSize: 11, color: "#90a4ae", marginTop: 1 }}>📝 {item.memo}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0, background: "#f0f4f8", borderRadius: 20, padding: "3px 4px" }}>
        <button onClick={e => { e.stopPropagation(); onIncrement(item.id, -1); }} style={{ ...qtyBtn, background: "transparent", border: "none" }}>－</button>
        <span style={{ minWidth: 36, textAlign: "center", fontSize: 12, fontWeight: 800, color: item.quantity === 0 ? "#e53935" : "#263238" }}>{item.quantity}{item.unit}</span>
        <button onClick={e => { e.stopPropagation(); onIncrement(item.id, 1); }} style={{ ...qtyBtn, background: "transparent", border: "none" }}>＋</button>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <button onClick={e => { e.stopPropagation(); onEdit(item); }} style={iconBtn("rgba(0,0,0,0.06)")}>✏️</button>
        <button onClick={e => { e.stopPropagation(); onDelete(item.id); }} style={iconBtn("rgba(229,57,53,0.1)")}>🗑️</button>
      </div>
    </div>
  );
}

// 指に追従するゴーストカード
function DragGhost({ item, x, y }) {
  const cat = CATEGORIES.find(c => c.id === item.category) || CATEGORIES[5];
  return (
    <div style={{
      position: "fixed",
      left: x - 24, top: y - 24,
      pointerEvents: "none", zIndex: 9999,
      background: "#fff",
      border: `2px solid ${cat.color}`,
      borderRadius: 14, padding: "10px 14px",
      display: "flex", alignItems: "center", gap: 8,
      boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
      transform: "rotate(2deg) scale(1.05)",
      minWidth: 120, maxWidth: 220,
      fontSize: 14, fontWeight: 700, color: "#263238",
    }}>
      <span style={{ fontSize: 20 }}>{cat.emoji}</span>
      <span>{item.name}</span>
      <span style={{ fontSize: 12, color: "#90a4ae", fontWeight: 400 }}>{item.quantity}{item.unit}</span>
    </div>
  );
}

function ListView({ items, onEdit, onDelete, onIncrement }) {
  if (items.length === 0) return (
    <div style={{ textAlign: "center", padding: "48px 24px", color: "#90a4ae", background: "#fff", borderRadius: 16, border: "2px dashed #cfd8dc" }}>
      <div style={{ fontSize: 40 }}>🧺</div>
      <div style={{ fontWeight: 600, marginTop: 8 }}>食材が見つかりません</div>
      <div style={{ fontSize: 13, marginTop: 4 }}>「手動追加」か「音声入力」で登録しましょう</div>
    </div>
  );
  return <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{items.map(item => <ItemCard key={item.id} item={item} onEdit={onEdit} onDelete={onDelete} onIncrement={onIncrement} />)}</div>;
}

// ─── Item Card ─────────────────────────────────────────────────────────────────
function ItemCard({ item, onEdit, onDelete, onIncrement, compact = false }) {
  const cat = CATEGORIES.find(c => c.id === item.category) || CATEGORIES[5];
  const area = AREAS.find(a => a.id === (item.area || "none")) || AREAS[3];
  const urgency = urgencyLevel(item.expDate);
  const us = urgencyStyles[urgency];
  const diff = item.expDate ? Math.ceil((new Date(item.expDate) - new Date()) / 86400000) : null;

  return (
    <div style={{ background: us.bg, border: `1.5px solid ${us.border}`, borderRadius: compact ? 12 : 16, padding: compact ? "10px 12px" : "14px 16px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: cat.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
        {cat.emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: compact ? 14 : 15, color: "#263238" }}>{item.name}</span>
          {urgency !== "none" && <span style={{ background: us.badge, color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 6, padding: "1px 5px" }}>{us.label}</span>}
          {!compact && item.area && item.area !== "none" && (
            <span style={{ background: area.color + "22", color: area.color, fontSize: 9, fontWeight: 700, borderRadius: 6, padding: "1px 6px", border: `1px solid ${area.color}44` }}>{area.emoji}{area.label}</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "#607d8b", marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!compact && <span>{cat.label}</span>}
          {item.expDate && <span>期限: {item.expDate}{diff !== null && <span style={{ fontWeight: 700, color: us.badge, marginLeft: 3 }}>({diff < 0 ? `${Math.abs(diff)}日超過` : diff === 0 ? "今日" : `あと${diff}日`})</span>}</span>}
          {item.memo && <span>📝 {item.memo}</span>}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0, background: "#f0f4f8", borderRadius: 20, padding: "3px 4px" }}>
        <button onClick={() => onIncrement(item.id, -1)} style={{ ...qtyBtn, background: "transparent", border: "none" }}>－</button>
        <span style={{ minWidth: 38, textAlign: "center", fontSize: 12, fontWeight: 800, color: item.quantity === 0 ? "#e53935" : "#263238" }}>{item.quantity}{item.unit}</span>
        <button onClick={() => onIncrement(item.id, 1)} style={{ ...qtyBtn, background: "transparent", border: "none" }}>＋</button>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <button onClick={() => onEdit(item)} style={iconBtn("rgba(0,0,0,0.06)")}>✏️</button>
        <button onClick={() => onDelete(item.id)} style={iconBtn("rgba(229,57,53,0.1)")}>🗑️</button>
      </div>
    </div>
  );
}

// ─── Shopping Tab ─────────────────────────────────────────────────────────────
function ShoppingTab({ items, setItems, inventoryItems, setInventoryItems }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [filterCat, setFilterCat] = useState("all");
  const [showBought, setShowBought] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [addedItems, setAddedItems] = useState([]);

  const emptyForm = { name: "", category: "other", quantity: 1, unit: "個", memo: "" };
  const [form, setForm] = useState(emptyForm);

  const handleAiAdd = () => {
    if (!aiInput.trim()) return;
    setAiError(""); setAddedItems([]);
    const results = parseItemsFromText(aiInput);
    if (results.length === 0) { setAiError("商品を認識できませんでした。読点（、）で区切って入力してみてください。"); return; }
    const now = new Date().toISOString();
    const newItems = results.map(r => ({ ...r, id: Date.now() + Math.random(), addedAt: now, bought: false }));
    setItems(prev => [...newItems, ...prev]);
    setAddedItems(newItems);
    setAiInput("");
  };

  const openAdd = () => { setForm(emptyForm); setEditId(null); setShowForm(true); };
  const openEdit = (item) => {
    setForm({ name: item.name, category: item.category, quantity: item.quantity, unit: item.unit, memo: item.memo || "" });
    setEditId(item.id); setShowForm(true);
  };
  const handleSubmit = () => {
    if (!form.name.trim()) return;
    if (editId) {
      setItems(prev => prev.map(i => i.id === editId ? { ...i, ...form } : i));
    } else {
      setItems(prev => [...prev, { ...form, id: Date.now(), addedAt: new Date().toISOString(), bought: false }]);
    }
    setShowForm(false); setEditId(null);
  };
  const toggleBought = (id) => setItems(prev => prev.map(i => i.id === id ? { ...i, bought: !i.bought } : i));
  const deleteItem = (id) => setItems(prev => prev.filter(i => i.id !== id));

  // Move bought item to inventory
  const addToInventory = (shopItem) => {
    setInventoryItems(prev => [...prev, {
      id: Date.now(), name: shopItem.name, category: shopItem.category,
      area: "none", quantity: shopItem.quantity, unit: shopItem.unit, memo: shopItem.memo || "",
      expDate: "", addedAt: new Date().toISOString(),
    }]);
    setItems(prev => prev.filter(i => i.id !== shopItem.id));
  };

  const filtered = items
    .filter(i => showBought ? i.bought : !i.bought)
    .filter(i => filterCat === "all" || i.category === filterCat);

  const boughtCount = items.filter(i => i.bought).length;
  const totalCount = items.filter(i => !i.bought).length;

  return (
    <>
      {/* Progress */}
      {items.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, padding: "12px 16px", marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12, color: "#546e7a" }}>
            <span>購入済み {boughtCount} / {items.length}品</span>
            <span style={{ fontWeight: 700, color: boughtCount === items.length ? "#2e7d32" : "#546e7a" }}>
              {items.length === 0 ? "–" : Math.round(boughtCount / items.length * 100)}%
            </span>
          </div>
          <div style={{ height: 6, background: "#e0e0e0", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${items.length === 0 ? 0 : boughtCount / items.length * 100}%`, background: "linear-gradient(90deg, #43a047, #66bb6a)", borderRadius: 3, transition: "width 0.3s" }} />
          </div>
        </div>
      )}

      {/* AI Text Input */}
      <div style={{ background: "#fff", borderRadius: 16, padding: "14px", marginBottom: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.07)", border: "1.5px solid #c8e6c9" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#2e7d32", marginBottom: 8 }}>📝 テキスト入力で自動追加 — まとめて入力してカテゴリを自動判定</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={aiInput}
            onChange={e => setAiInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleAiAdd()}
            placeholder="例: 卵1パック、豚バラ、オレンジジュース2本"
            style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: "1.5px solid #e0e0e0", fontSize: 13, outline: "none", background: "#fafafa" }}
          />
          <button onClick={handleAiAdd} disabled={!aiInput.trim()} style={primaryBtn("#1565c0", !aiInput.trim())}>
            追加
          </button>
        </div>
        {aiError && <div style={{ marginTop: 8, fontSize: 12, color: "#c62828" }}>⚠️ {aiError}</div>}
        {addedItems.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#388e3c" }}>✅ {addedItems.length}品を追加しました</div>
            {addedItems.map((it, i) => {
              const cat = CATEGORIES.find(c => c.id === it.category) || CATEGORIES[5];
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, background: "#f1f8e9", borderRadius: 8, padding: "5px 10px" }}>
                  <span>{cat.emoji}</span>
                  <span style={{ fontWeight: 700 }}>{it.name}</span>
                  <span style={{ color: "#78909c" }}>{it.quantity}{it.unit}</span>
                  <span style={{ marginLeft: "auto", background: cat.color + "22", color: cat.color, borderRadius: 6, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{cat.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <button onClick={openAdd} style={primaryBtn("#2e7d32")}>＋ 手動追加</button>
        <button onClick={() => setShowBought(v => !v)} style={{ marginLeft: "auto", ...chipStyle(showBought, "#546e7a"), fontSize: 12 }}>
          {showBought ? "✅ 購入済み" : `📋 未購入 (${totalCount})`}
        </button>
      </div>

      {(aiError) && (
        <div style={{ background: "#ffebee", border: "1.5px solid #ef9a9a", borderRadius: 12, padding: "10px 14px", marginBottom: 10, fontSize: 13, color: "#c62828" }}>
          ⚠️ {aiError}
        </div>
      )}

      {/* Category filter */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none", marginBottom: 12 }}>
        <button onClick={() => setFilterCat("all")} style={chipStyle(filterCat === "all", "#2e7d32")}>🛒 全て</button>
        {CATEGORIES.map(c => <button key={c.id} onClick={() => setFilterCat(c.id)} style={chipStyle(filterCat === c.id, c.color)}>{c.emoji} {c.label}</button>)}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", color: "#90a4ae", background: "#fff", borderRadius: 16, border: "2px dashed #cfd8dc" }}>
          <div style={{ fontSize: 40 }}>🛒</div>
          <div style={{ fontWeight: 600, marginTop: 8 }}>リストが空です</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>上のテキスト入力か「手動追加」で登録しましょう</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(item => {
            const cat = CATEGORIES.find(c => c.id === item.category) || CATEGORIES[5];
            return (
              <div key={item.id} style={{
                background: item.bought ? "#f1f8e9" : "#fff", border: `1.5px solid ${item.bought ? "#a5d6a7" : "#e0e0e0"}`,
                borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10,
                opacity: item.bought ? 0.7 : 1, boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
              }}>
                <button onClick={() => toggleBought(item.id)} style={{
                  width: 26, height: 26, borderRadius: "50%", border: `2px solid ${item.bought ? "#43a047" : "#b0bec5"}`,
                  background: item.bought ? "#43a047" : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14,
                }}>
                  {item.bought ? "✓" : ""}
                </button>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: cat.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                  {cat.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#263238", textDecoration: item.bought ? "line-through" : "none" }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: "#90a4ae" }}>{cat.label}　{item.quantity}{item.unit}{item.memo ? `　${item.memo}` : ""}</div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {item.bought && (
                    <button onClick={() => addToInventory(item)} title="在庫に追加" style={{ ...iconBtn("#e8f5e9"), fontSize: 13 }}>📥</button>
                  )}
                  <button onClick={() => openEdit(item)} style={iconBtn("rgba(0,0,0,0.06)")}>✏️</button>
                  <button onClick={() => deleteItem(item.id)} style={iconBtn("rgba(229,57,53,0.1)")}>🗑️</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <FormModal
          title={editId ? "✏️ 商品を編集" : "➕ 買い物リストに追加"}
          form={form} setForm={setForm}
          onClose={() => setShowForm(false)}
          onSubmit={handleSubmit}
          submitLabel={editId ? "更新する" : "追加する"}
          showArea={false}
        />
      )}
    </>
  );
}

// ─── Form Modal ────────────────────────────────────────────────────────────────
function FormModal({ title, form, setForm, onClose, onSubmit, submitLabel, showArea }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 640, padding: "24px 20px 40px", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#263238" }}>{title}</h2>
          <button onClick={onClose} style={{ background: "#eceff1", border: "none", borderRadius: 20, width: 30, height: 30, cursor: "pointer", fontSize: 15 }}>✕</button>
        </div>

        <label style={lbl}>食材名 *</label>
        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="例: にんじん" style={inp} />

        <label style={lbl}>カテゴリ</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setForm(p => ({ ...p, category: c.id }))} style={{
              padding: "5px 11px", borderRadius: 16, border: `2px solid ${form.category === c.id ? c.color : "#e0e0e0"}`,
              background: form.category === c.id ? c.color + "22" : "#fafafa",
              cursor: "pointer", fontSize: 12, fontWeight: form.category === c.id ? 700 : 400,
            }}>{c.emoji} {c.label}</button>
          ))}
        </div>

        {showArea && (
          <>
            <label style={lbl}>冷蔵庫エリア</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {AREAS.map(a => (
                <button key={a.id} onClick={() => setForm(p => ({ ...p, area: a.id }))} style={{
                  flex: 1, padding: "8px 4px", borderRadius: 12, border: `2px solid ${form.area === a.id ? a.color : "#e0e0e0"}`,
                  background: form.area === a.id ? a.color + "22" : "#fafafa",
                  cursor: "pointer", fontSize: 12, fontWeight: form.area === a.id ? 700 : 400, textAlign: "center",
                }}>{a.emoji}<br />{a.label}</button>
              ))}
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>数量</label>
            <input type="number" min="0" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: Number(e.target.value) }))} style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>単位</label>
            <select value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} style={inp}>
              {UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
        </div>

        {showArea && (
          <>
            <label style={lbl}>賞味期限・消費期限</label>
            <input type="date" value={form.expDate} onChange={e => setForm(p => ({ ...p, expDate: e.target.value }))} style={inp} />
          </>
        )}

        <label style={lbl}>メモ</label>
        <input value={form.memo} onChange={e => setForm(p => ({ ...p, memo: e.target.value }))} placeholder="例: 開封済み" style={inp} />

        <button onClick={onSubmit} style={{ width: "100%", padding: "14px", marginTop: 4, background: "linear-gradient(135deg, #2e7d32, #43a047)", color: "#fff", border: "none", borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 12px rgba(46,125,50,0.3)" }}>
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Style helpers ─────────────────────────────────────────────────────────────
const chipStyle = (active, color) => ({
  flexShrink: 0, padding: "6px 13px", borderRadius: 18,
  border: `2px solid ${active ? color : "#ddd"}`,
  background: active ? color + "22" : "#fff",
  color: active ? color : "#607d8b", fontWeight: active ? 700 : 400,
  cursor: "pointer", fontSize: 12, whiteSpace: "nowrap",
});

const primaryBtn = (color, disabled = false) => ({
  padding: "8px 14px", borderRadius: 18, border: "none",
  background: disabled ? "#ccc" : color, color: "#fff",
  fontWeight: 700, fontSize: 13, cursor: disabled ? "not-allowed" : "pointer",
  boxShadow: disabled ? "none" : `0 2px 8px ${color}55`,
});

const qtyBtn = {
  width: 26, height: 26, borderRadius: 7, border: "1.5px solid #b0bec5",
  background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 800,
  display: "flex", alignItems: "center", justifyContent: "center", color: "#455a64",
};

const iconBtn = (bg) => ({
  background: bg, border: "none", borderRadius: 8,
  width: 30, height: 30, cursor: "pointer", fontSize: 13,
});

const lbl = { display: "block", fontSize: 11, fontWeight: 700, color: "#607d8b", marginBottom: 5 };
const inp = { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 10, border: "1.5px solid #e0e0e0", fontSize: 14, background: "#fafafa", color: "#263238", marginBottom: 14, outline: "none" };
