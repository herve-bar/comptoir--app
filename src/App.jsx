import { useState, useMemo, useRef, useEffect } from "react";
import { Plus, Trash2, Search, Package, Receipt, AlertTriangle, X, Printer, Minus } from "lucide-react";

// ---------- Stockage local (persiste rÃ©ellement sur le tÃ©lÃ©phone) ----------
const STORAGE_KEYS = {
  produits: "comptoir:produits",
  factures: "comptoir:factures",
  factureNum: "comptoir:factureNum",
};

const PRODUITS_INIT = [
  { id: "p1", nom: "CafÃ© moulu 250g", prix: 2500, stock: 32, seuil: 10, categorie: "Ã‰picerie" },
  { id: "p2", nom: "Savon artisanal", prix: 1500, stock: 6, seuil: 8, categorie: "HygiÃ¨ne" },
  { id: "p3", nom: "Carnet lignÃ© A5", prix: 1000, stock: 18, seuil: 5, categorie: "Papeterie" },
  { id: "p4", nom: "Bougie parfumÃ©e", prix: 3500, stock: 3, seuil: 5, categorie: "DÃ©co" },
  { id: "p5", nom: "ThÃ© vert 100g", prix: 2000, stock: 24, seuil: 10, categorie: "Ã‰picerie" },
];

function chargerStockage(cle, valeurDefaut) {
  try {
    const brut = localStorage.getItem(cle);
    if (!brut) return valeurDefaut;
    return JSON.parse(brut);
  } catch {
    return valeurDefaut;
  }
}

function sauverStockage(cle, valeur) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    // stockage plein ou indisponible : on ignore silencieusement
  }
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function formatEUR(n) {
  return Math.round(n).toLocaleString("fr-FR") + " FCFA";
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ---------- App ----------
export default function App() {
  const [produits, setProduits] = useState(() => chargerStockage(STORAGE_KEYS.produits, PRODUITS_INIT));
  const [factures, setFactures] = useState(() => chargerStockage(STORAGE_KEYS.factures, []));
  const [factureNum, setFactureNum] = useState(() => chargerStockage(STORAGE_KEYS.factureNum, 1));
  const [page, setPage] = useState("stock");
  const [panier, setPanier] = useState([]);
  const [toast, setToast] = useState(null);
  const factureRef = useRef(null);
  const [factureAffichee, setFactureAffichee] = useState(null);

  // Persistance automatique Ã  chaque changement
  useEffect(() => sauverStockage(STORAGE_KEYS.produits, produits), [produits]);
  useEffect(() => sauverStockage(STORAGE_KEYS.factures, factures), [factures]);
  useEffect(() => sauverStockage(STORAGE_KEYS.factureNum, factureNum), [factureNum]);

  function notify(msg, type = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2600);
  }

  function ajouterAuPanier(produit) {
    setPanier((p) => {
      const existe = p.find((l) => l.produitId === produit.id);
      const stockDispo = produit.stock;
      if (existe) {
        if (existe.qte >= stockDispo) {
          notify(`Stock insuffisant pour ${produit.nom}`, "warn");
          return p;
        }
        return p.map((l) => (l.produitId === produit.id ? { ...l, qte: l.qte + 1 } : l));
      }
      if (stockDispo <= 0) {
        notify(`${produit.nom} est en rupture de stock`, "warn");
        return p;
      }
      return [...p, { produitId: produit.id, qte: 1 }];
    });
  }

  function changerQte(produitId, delta) {
    setPanier((p) =>
      p
        .map((l) => {
          if (l.produitId !== produitId) return l;
          const produit = produits.find((pr) => pr.id === produitId);
          const newQte = l.qte + delta;
          if (newQte > produit.stock) {
            notify(`Stock max atteint pour ${produit.nom}`, "warn");
            return l;
          }
          return { ...l, qte: newQte };
        })
        .filter((l) => l.qte > 0)
    );
  }

  function retirerDuPanier(produitId) {
    setPanier((p) => p.filter((l) => l.produitId !== produitId));
  }

  const lignesPanier = useMemo(
    () =>
      panier.map((l) => {
        const produit = produits.find((p) => p.id === l.produitId);
        return { ...l, produit, total: produit ? produit.prix * l.qte : 0 };
      }),
    [panier, produits]
  );

  const totalPanier = lignesPanier.reduce((s, l) => s + l.total, 0);

  function validerFacture(client) {
    if (lignesPanier.length === 0) {
      notify("Le panier est vide", "warn");
      return;
    }
    const num = `F-${String(factureNum).padStart(4, "0")}`;
    const nouvelleFacture = {
      id: uid("fac"),
      numero: num,
      date: new Date().toISOString(),
      client: client || "Client comptoir",
      lignes: lignesPanier.map((l) => ({
        nom: l.produit.nom,
        prixUnitaire: l.produit.prix,
        qte: l.qte,
        total: l.total,
      })),
      total: totalPanier,
    };

    setProduits((prods) =>
      prods.map((p) => {
        const ligne = panier.find((l) => l.produitId === p.id);
        if (!ligne) return p;
        return { ...p, stock: Math.max(0, p.stock - ligne.qte) };
      })
    );

    setFactures((f) => [nouvelleFacture, ...f]);
    setFactureNum((n) => n + 1);
    setPanier([]);
    setFactureAffichee(nouvelleFacture);
    notify(`Facture ${num} crÃ©Ã©e`, "ok");
  }

  function imprimerFacture() {
    if (!factureRef.current) return;
    const contenu = factureRef.current.innerHTML;
    const w = window.open("", "_blank", "width=420,height=600");
    w.document.write(`
      <html>
        <head>
          <title>Facture</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 24px; color: #2B2420; }
            .ticket-header { text-align:center; border-bottom: 2px dashed #2B2420; padding-bottom:10px; margin-bottom:10px;}
            table { width:100%; border-collapse: collapse; margin: 12px 0; }
            td, th { padding: 4px 0; font-size: 13px; }
            .total-row { border-top: 2px dashed #2B2420; font-weight:bold; }
            .stamp { color:#B8432F; border:3px solid #B8432F; display:inline-block; padding:4px 14px; transform:rotate(-6deg); font-weight:bold; letter-spacing:2px; margin-top:14px;}
          </style>
        </head>
        <body>${contenu}</body>
      </html>
    `);
    w.document.close();
    w.print();
  }

  const estMobile = useEstMobile();

  return (
    <div style={styles.app}>
      <Sidebar page={page} setPage={setPage} panierCount={panier.length} produits={produits} />

      <main style={{ ...styles.main, ...(estMobile ? styles.mainMobilePad : {}) }}>
        {page === "stock" && (
          <PageStock produits={produits} setProduits={setProduits} ajouterAuPanier={ajouterAuPanier} notify={notify} />
        )}
        {page === "vente" && (
          <PageVente
            produits={produits}
            ajouterAuPanier={ajouterAuPanier}
            lignesPanier={lignesPanier}
            changerQte={changerQte}
            retirerDuPanier={retirerDuPanier}
            totalPanier={totalPanier}
            validerFacture={validerFacture}
          />
        )}
        {page === "factures" && <PageFactures factures={factures} onVoir={setFactureAffichee} />}
      </main>

      {factureAffichee && (
        <FactureModal
          facture={factureAffichee}
          onClose={() => setFactureAffichee(null)}
          onImprimer={imprimerFacture}
          factureRef={factureRef}
        />
      )}

      {toast && <Toast toast={toast} />}
    </div>
  );
}

// ---------- Sidebar ----------
function useEstMobile() {
  const [estMobile, setEstMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 860 : true
  );
  useEffect(() => {
    function onResize() {
      setEstMobile(window.innerWidth < 860);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return estMobile;
}

function Sidebar({ page, setPage, panierCount, produits }) {
  const [ouvert, setOuvert] = useState(false);
  const estMobile = useEstMobile();
  const alertes = produits.filter((p) => p.stock <= p.seuil).length;
  const items = [
    { key: "stock", label: "Stock", icon: Package, badge: alertes > 0 ? alertes : null, badgeColor: "#D4A03C" },
    { key: "vente", label: "Nouvelle vente", icon: Receipt, badge: panierCount > 0 ? panierCount : null, badgeColor: "#B8432F" },
    { key: "factures", label: "Factures", icon: Receipt },
  ];

  function choisir(key) {
    setPage(key);
    setOuvert(false);
  }

  // Sur mobile, la sidebar n'est rendue que si elle est ouverte.
  const sidebarVisible = !estMobile || ouvert;

  return (
    <>
      {estMobile && (
        <div style={styles.mobileTopbar}>
          <div style={styles.brand}>
            <div style={styles.brandStamp}>CO</div>
            <div style={styles.brandName}>Comptoir</div>
          </div>
          <button style={styles.burgerBtn} onClick={() => setOuvert(!ouvert)} aria-label="Menu">
            <div style={styles.burgerLine} />
            <div style={styles.burgerLine} />
            <div style={styles.burgerLine} />
          </button>
        </div>
      )}

      {sidebarVisible && (
        <aside
          style={{
            ...styles.sidebar,
            ...(estMobile
              ? {
                  position: "fixed",
                  top: 0,
                  left: 0,
                  bottom: 0,
                  zIndex: 60,
                  width: "78vw",
                  maxWidth: 280,
                  boxShadow: "4px 0 24px rgba(0,0,0,0.35)",
                }
              : {}),
          }}
        >
          <div style={styles.brand}>
            <div style={styles.brandStamp}>CO</div>
            <div>
              <div style={styles.brandName}>Comptoir</div>
              <div style={styles.brandSub}>Gestion de stock</div>
            </div>
          </div>
          <nav style={styles.nav}>
            {items.map(({ key, label, icon: Icon, badge, badgeColor }) => (
              <button
                key={key}
                onClick={() => choisir(key)}
                style={{ ...styles.navItem, ...(page === key ? styles.navItemActive : {}) }}
              >
                <Icon size={18} strokeWidth={2} />
                <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
                {badge != null && <span style={{ ...styles.navBadge, background: badgeColor }}>{badge}</span>}
              </button>
            ))}
          </nav>
          <div style={styles.sidebarFooter}>Les donnÃ©es sont enregistrÃ©es sur cet appareil.</div>
        </aside>
      )}

      {estMobile && ouvert && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 50,
          }}
          onClick={() => setOuvert(false)}
        />
      )}
    </>
  );
}

// ---------- Page Stock ----------
function PageStock({ produits, setProduits, ajouterAuPanier, notify }) {
  const [recherche, setRecherche] = useState("");
  const [modalOuvert, setModalOuvert] = useState(false);
  const [edition, setEdition] = useState(null);

  const filtres = produits.filter(
    (p) =>
      p.nom.toLowerCase().includes(recherche.toLowerCase()) ||
      p.categorie.toLowerCase().includes(recherche.toLowerCase())
  );

  function sauvegarder(produit) {
    if (produit.id) {
      setProduits((ps) => ps.map((p) => (p.id === produit.id ? produit : p)));
      notify(`${produit.nom} mis Ã  jour`);
    } else {
      setProduits((ps) => [...ps, { ...produit, id: uid("p") }]);
      notify(`${produit.nom} ajoutÃ© au stock`);
    }
    setModalOuvert(false);
    setEdition(null);
  }

  function supprimer(id) {
    const p = produits.find((x) => x.id === id);
    setProduits((ps) => ps.filter((x) => x.id !== id));
    notify(`${p.nom} supprimÃ©`, "warn");
  }

  return (
    <div>
      <header style={styles.pageHeader}>
        <div>
          <h1 style={styles.h1}>Stock</h1>
          <p style={styles.pageSub}>{produits.length} articles rÃ©fÃ©rencÃ©s</p>
        </div>
        <button
          style={styles.btnPrimary}
          onClick={() => {
            setEdition(null);
            setModalOuvert(true);
          }}
        >
          <Plus size={16} /> Ajouter
        </button>
      </header>

      <div style={styles.searchBar}>
        <Search size={16} color="#8A7F6F" />
        <input
          placeholder="Rechercher un articleâ€¦"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      <div style={styles.cardList}>
        {filtres.map((p) => {
          const bas = p.stock <= p.seuil;
          return (
            <div key={p.id} style={styles.stockCard}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.stockCardNom}>{p.nom}</div>
                <div style={styles.stockCardMeta}>
                  <span style={styles.tag}>{p.categorie}</span>
                  <span>{formatEUR(p.prix)}</span>
                </div>
              </div>
              <div style={styles.stockCardRight}>
                <span style={{ ...styles.stockPill, ...(bas ? styles.stockPillBas : {}) }}>
                  {bas && <AlertTriangle size={12} />} {p.stock}
                </span>
                <div style={styles.stockCardActions}>
                  <button style={styles.btnGhost} onClick={() => ajouterAuPanier(p)}>Vendre</button>
                  <button
                    style={styles.btnGhost}
                    onClick={() => {
                      setEdition(p);
                      setModalOuvert(true);
                    }}
                  >
                    Modifier
                  </button>
                  <button style={styles.btnGhostDanger} onClick={() => supprimer(p.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {filtres.length === 0 && <div style={styles.emptyRow}>Aucun article ne correspond Ã  cette recherche.</div>}
      </div>

      {modalOuvert && (
        <ProduitModal
          produit={edition}
          onClose={() => {
            setModalOuvert(false);
            setEdition(null);
          }}
          onSave={sauvegarder}
        />
      )}
    </div>
  );
}

function ProduitModal({ produit, onClose, onSave }) {
  const [nom, setNom] = useState(produit?.nom || "");
  const [prix, setPrix] = useState(produit?.prix ?? "");
  const [stock, setStock] = useState(produit?.stock ?? "");
  const [seuil, setSeuil] = useState(produit?.seuil ?? 5);
  const [categorie, setCategorie] = useState(produit?.categorie || "");

  function submit(e) {
    e.preventDefault();
    if (!nom.trim() || prix === "" || stock === "") return;
    onSave({
      id: produit?.id,
      nom: nom.trim(),
      prix: parseFloat(prix),
      stock: parseInt(stock, 10),
      seuil: parseInt(seuil, 10) || 0,
      categorie: categorie.trim() || "Divers",
    });
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <form style={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div style={styles.modalHeader}>
          <h2 style={styles.h2}>{produit ? "Modifier l'article" : "Nouvel article"}</h2>
          <button type="button" onClick={onClose} style={styles.iconBtn}>
            <X size={18} />
          </button>
        </div>

        <label style={styles.label}>Nom de l'article</label>
        <input style={styles.input} value={nom} onChange={(e) => setNom(e.target.value)} autoFocus required />

        <label style={styles.label}>CatÃ©gorie</label>
        <input style={styles.input} value={categorie} onChange={(e) => setCategorie(e.target.value)} placeholder="Ã‰picerie, HygiÃ¨neâ€¦" />

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>Prix (FCFA)</label>
            <input style={styles.input} type="number" step="1" min="0" value={prix} onChange={(e) => setPrix(e.target.value)} required />
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>Stock</label>
            <input style={styles.input} type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} required />
          </div>
        </div>

        <label style={styles.label}>Seuil d'alerte</label>
        <input style={styles.input} type="number" min="0" value={seuil} onChange={(e) => setSeuil(e.target.value)} />

        <div style={styles.modalActions}>
          <button type="button" style={styles.btnSecondary} onClick={onClose}>Annuler</button>
          <button type="submit" style={styles.btnPrimary}>Enregistrer</button>
        </div>
      </form>
    </div>
  );
}

// ---------- Page Vente ----------
function PageVente({ produits, ajouterAuPanier, lignesPanier, changerQte, retirerDuPanier, totalPanier, validerFacture }) {
  const [recherche, setRecherche] = useState("");
  const [client, setClient] = useState("");
  const [panierOuvertMobile, setPanierOuvertMobile] = useState(false);

  const filtres = produits.filter((p) => p.nom.toLowerCase().includes(recherche.toLowerCase()));

  return (
    <div style={styles.venteWrap}>
      <div>
        <header style={styles.pageHeader}>
          <div>
            <h1 style={styles.h1}>Nouvelle vente</h1>
            <p style={styles.pageSub}>Touchez un article pour l'ajouter</p>
          </div>
        </header>

        <div style={styles.searchBar}>
          <Search size={16} color="#8A7F6F" />
          <input
            placeholder="Rechercher un articleâ€¦"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        <div style={styles.produitGrid}>
          {filtres.map((p) => (
            <button
              key={p.id}
              onClick={() => ajouterAuPanier(p)}
              disabled={p.stock <= 0}
              style={{ ...styles.produitCard, ...(p.stock <= 0 ? styles.produitCardDisabled : {}) }}
            >
              <div style={styles.produitCardNom}>{p.nom}</div>
              <div style={styles.produitCardCat}>{p.categorie}</div>
              <div style={styles.produitCardFooter}>
                <span style={styles.produitCardPrix}>{formatEUR(p.prix)}</span>
                <span style={p.stock <= 0 ? styles.produitCardStockNul : styles.produitCardStock}>
                  {p.stock <= 0 ? "Rupture" : `${p.stock} dispo.`}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Panier desktop : panneau latÃ©ral. Mobile : tiroir en bas */}
      <div style={styles.panierPanel}>
        <PanierContenu
          lignesPanier={lignesPanier}
          changerQte={changerQte}
          retirerDuPanier={retirerDuPanier}
          totalPanier={totalPanier}
          validerFacture={validerFacture}
          client={client}
          setClient={setClient}
        />
      </div>

      {lignesPanier.length > 0 && (
        <button style={styles.fabPanier} onClick={() => setPanierOuvertMobile(true)}>
          <Receipt size={18} />
          <span>{lignesPanier.length} article{lignesPanier.length > 1 ? "s" : ""}</span>
          <strong>{formatEUR(totalPanier)}</strong>
        </button>
      )}

      {panierOuvertMobile && (
        <div style={styles.overlay} onClick={() => setPanierOuvertMobile(false)}>
          <div style={styles.panierDrawerMobile} onClick={(e) => e.stopPropagation()}>
            <button style={{ ...styles.iconBtn, alignSelf: "flex-end" }} onClick={() => setPanierOuvertMobile(false)}>
              <X size={20} />
            </button>
            <PanierContenu
              lignesPanier={lignesPanier}
              changerQte={changerQte}
              retirerDuPanier={retirerDuPanier}
              totalPanier={totalPanier}
              validerFacture={(c) => {
                validerFacture(c);
                setPanierOuvertMobile(false);
              }}
              client={client}
              setClient={setClient}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PanierContenu({ lignesPanier, changerQte, retirerDuPanier, totalPanier, validerFacture, client, setClient }) {
  return (
    <>
      <h2 style={styles.h2}>Panier</h2>
      {lignesPanier.length === 0 ? (
        <p style={styles.panierVide}>Le panier est vide. Touchez un article pour l'ajouter.</p>
      ) : (
        <div style={styles.panierLignes}>
          {lignesPanier.map((l) => (
            <div key={l.produitId} style={styles.panierLigne}>
              <div style={{ flex: 1 }}>
                <div style={styles.panierLigneNom}>{l.produit.nom}</div>
                <div style={styles.panierLigneSub}>{formatEUR(l.produit.prix)} / unitÃ©</div>
              </div>
              <div style={styles.qteControl}>
                <button style={styles.qteBtn} onClick={() => changerQte(l.produitId, -1)}>
                  <Minus size={12} />
                </button>
                <span style={styles.qteVal}>{l.qte}</span>
                <button style={styles.qteBtn} onClick={() => changerQte(l.produitId, 1)}>
                  <Plus size={12} />
                </button>
              </div>
              <div style={styles.panierLigneTotal}>{formatEUR(l.total)}</div>
              <button style={styles.iconBtn} onClick={() => retirerDuPanier(l.produitId)}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={styles.panierTotalRow}>
        <span>Total</span>
        <strong>{formatEUR(totalPanier)}</strong>
      </div>

      <label style={styles.label}>Client (facultatif)</label>
      <input style={styles.input} placeholder="Nom du client" value={client} onChange={(e) => setClient(e.target.value)} />

      <button
        style={{ ...styles.btnPrimary, width: "100%", justifyContent: "center", marginTop: 12 }}
        onClick={() => {
          validerFacture(client);
          setClient("");
        }}
      >
        <Receipt size={16} /> Ã‰mettre la facture
      </button>
    </>
  );
}

// ---------- Page Factures ----------
function PageFactures({ factures, onVoir }) {
  return (
    <div>
      <header style={styles.pageHeader}>
        <div>
          <h1 style={styles.h1}>Factures</h1>
          <p style={styles.pageSub}>
            {factures.length} facture{factures.length !== 1 ? "s" : ""} Ã©mise{factures.length !== 1 ? "s" : ""}
          </p>
        </div>
      </header>

      {factures.length === 0 ? (
        <div style={styles.emptyState}>
          <Receipt size={32} color="#C7BBA8" />
          <p>Aucune facture pour le moment. Rendez-vous sur Â« Nouvelle vente Â» pour en crÃ©er une.</p>
        </div>
      ) : (
        <div style={styles.cardList}>
          {factures.map((f) => (
            <button key={f.id} style={styles.factureCard} onClick={() => onVoir(f)}>
              <div>
                <div style={styles.factureCardNum}>{f.numero}</div>
                <div style={styles.factureCardMeta}>
                  {formatDate(f.date)} Â· {f.client} Â· {f.lignes.length} article{f.lignes.length > 1 ? "s" : ""}
                </div>
              </div>
              <div style={styles.factureCardTotal}>{formatEUR(f.total)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Modal Facture (ticket) ----------
function FactureModal({ facture, onClose, onImprimer, factureRef }) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.factureModal} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={{ ...styles.iconBtn, position: "absolute", top: 14, right: 14 }}>
          <X size={18} />
        </button>

        <div ref={factureRef}>
          <div className="ticket-header" style={styles.ticketHeader}>
            <div style={styles.ticketBrand}>COMPTOIR</div>
            <div style={styles.ticketSub}>Facture {facture.numero}</div>
            <div style={styles.ticketSub}>{formatDate(facture.date)}</div>
          </div>

          <div style={styles.ticketClient}>Client : {facture.client}</div>

          <table style={styles.ticketTable}>
            <thead>
              <tr style={{ borderBottom: "1px dashed #2B2420" }}>
                <th style={styles.ticketTh}>Article</th>
                <th style={styles.ticketTh}>QtÃ©</th>
                <th style={{ ...styles.ticketTh, textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {facture.lignes.map((l, i) => (
                <tr key={i}>
                  <td style={styles.ticketTd}>{l.nom}</td>
                  <td style={styles.ticketTd}>{l.qte}</td>
                  <td style={{ ...styles.ticketTd, textAlign: "right" }}>{formatEUR(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="total-row" style={styles.ticketTotalRow}>
            <span>TOTAL</span>
            <span>{formatEUR(facture.total)}</span>
          </div>

          <div style={{ textAlign: "center" }}>
            <span className="stamp" style={styles.stamp}>PAYÃ‰</span>
          </div>
        </div>

        <button style={{ ...styles.btnPrimary, width: "100%", justifyContent: "center", marginTop: 20 }} onClick={onImprimer}>
          <Printer size={16} /> Imprimer le ticket
        </button>
      </div>
    </div>
  );
}

// ---------- Toast ----------
function Toast({ toast }) {
  return (
    <div style={{ ...styles.toast, ...(toast.type === "warn" ? styles.toastWarn : {}) }}>
      {toast.type === "warn" && <AlertTriangle size={14} />}
      {toast.msg}
    </div>
  );
}

// ---------- Styles ----------
const COL = {
  bg: "#F2EBE1",
  bgPanel: "#FBF8F2",
  ink: "#2B2420",
  inkSoft: "#6E6356",
  border: "#E1D7C5",
  red: "#B8432F",
  green: "#5C7A5C",
  yellow: "#D4A03C",
};

const styles = {
  app: { display: "flex", minHeight: "100vh", background: COL.bg, color: COL.ink, fontFamily: "'Inter', system-ui, sans-serif" },

  mobileTopbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    background: COL.ink,
    color: "#fff",
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
  },
  burgerBtn: { background: "transparent", border: "none", display: "flex", flexDirection: "column", gap: 4, padding: 6, cursor: "pointer" },
  burgerLine: { width: 20, height: 2, background: "#fff", borderRadius: 1 },

  sidebar: {
    width: 240,
    background: COL.ink,
    color: "#F2EBE1",
    display: "flex",
    flexDirection: "column",
    padding: "24px 16px",
    flexShrink: 0,
  },
  sidebarOpenMobile: {},
  brandDesktopOnly: {},
  overlayMobile: { display: "none" },

  brand: { display: "flex", alignItems: "center", gap: 10, padding: "0 6px" },
  brandStamp: {
    width: 34,
    height: 34,
    borderRadius: 8,
    background: COL.red,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Georgia, serif",
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: 1,
    flexShrink: 0,
  },
  brandName: { fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 700 },
  brandSub: { fontSize: 11.5, color: "#B8AD9C" },
  nav: { display: "flex", flexDirection: "column", gap: 4, flex: 1, marginTop: 24 },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "13px 12px",
    borderRadius: 8,
    background: "transparent",
    color: "#D8CFC0",
    border: "none",
    fontSize: 14.5,
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
  },
  navItemActive: { background: "#3D352C", color: "#FFFFFF" },
  navBadge: { fontSize: 11, fontWeight: 700, color: "#2B2420", borderRadius: 10, padding: "1px 7px" },
  sidebarFooter: { fontSize: 11, color: "#8A7F6F", lineHeight: 1.5, paddingTop: 16, borderTop: "1px solid #3D352C" },

  main: { flex: 1, padding: "16px", overflowY: "auto", minWidth: 0, paddingBottom: 100, width: "100%" },
  mainMobilePad: { paddingTop: 70 },

  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, gap: 12, flexWrap: "wrap" },
  h1: { fontFamily: "Georgia, serif", fontSize: 26, margin: 0, fontWeight: 700 },
  h2: { fontFamily: "Georgia, serif", fontSize: 19, margin: 0, fontWeight: 700 },
  pageSub: { color: COL.inkSoft, fontSize: 13.5, margin: "4px 0 0" },

  btnPrimary: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: COL.red,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "11px 16px",
    fontSize: 13.5,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  btnSecondary: {
    background: "transparent",
    border: `1px solid ${COL.border}`,
    borderRadius: 8,
    padding: "11px 16px",
    fontSize: 13.5,
    fontWeight: 600,
    cursor: "pointer",
    color: COL.ink,
    fontFamily: "inherit",
  },
  btnGhost: { background: "transparent", border: "none", color: COL.inkSoft, fontSize: 12.5, cursor: "pointer", padding: "6px 8px", fontFamily: "inherit", fontWeight: 600 },
  btnGhostDanger: { background: "transparent", border: "none", color: COL.red, cursor: "pointer", padding: "6px" },
  iconBtn: { background: "transparent", border: "none", cursor: "pointer", color: COL.inkSoft, padding: 4 },

  searchBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: COL.bgPanel,
    border: `1px solid ${COL.border}`,
    borderRadius: 10,
    padding: "12px 14px",
    marginBottom: 18,
    maxWidth: 420,
  },
  searchInput: { border: "none", outline: "none", background: "transparent", fontSize: 14, flex: 1, fontFamily: "inherit", color: COL.ink, minWidth: 0 },

  cardList: { display: "flex", flexDirection: "column", gap: 10 },
  stockCard: {
    background: COL.bgPanel,
    border: `1px solid ${COL.border}`,
    borderRadius: 12,
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  stockCardNom: { fontWeight: 700, fontSize: 14.5 },
  stockCardMeta: { display: "flex", gap: 10, alignItems: "center", marginTop: 4, fontSize: 12.5, color: COL.inkSoft },
  stockCardRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 },
  stockCardActions: { display: "flex", gap: 2 },

  factureCard: {
    background: COL.bgPanel,
    border: `1px solid ${COL.border}`,
    borderRadius: 12,
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "left",
    width: "100%",
  },
  factureCardNum: { fontWeight: 700, fontSize: 14.5 },
  factureCardMeta: { fontSize: 12, color: COL.inkSoft, marginTop: 3 },
  factureCardTotal: { fontWeight: 700, fontSize: 15 },

  tag: { background: "#EDE3D2", color: COL.inkSoft, fontSize: 11.5, padding: "3px 9px", borderRadius: 6, fontWeight: 600 },
  stockPill: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 14, fontWeight: 700 },
  stockPillBas: { color: COL.yellow },

  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    padding: "50px 20px",
    color: COL.inkSoft,
    fontSize: 14,
    textAlign: "center",
    background: COL.bgPanel,
    border: `1px dashed ${COL.border}`,
    borderRadius: 12,
  },
  emptyRow: { padding: "30px 18px", textAlign: "center", color: COL.inkSoft, fontSize: 13.5, background: COL.bgPanel, borderRadius: 12 },

  overlay: { position: "fixed", inset: 0, background: "rgba(43,36,32,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50, padding: 0 },
  modal: { background: COL.bgPanel, borderRadius: "16px 16px 0 0", padding: 24, width: "100%", maxWidth: 460, display: "flex", flexDirection: "column", gap: 4, maxHeight: "88vh", overflowY: "auto" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: 600, color: COL.inkSoft, marginTop: 12, marginBottom: 6 },
  input: { border: `1px solid ${COL.border}`, borderRadius: 8, padding: "12px 12px", fontSize: 15, fontFamily: "inherit", background: "#fff", color: COL.ink, width: "100%", boxSizing: "border-box" },

  venteWrap: { display: "block" },
  produitGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 },
  produitCard: {
    background: COL.bgPanel,
    border: `1px solid ${COL.border}`,
    borderRadius: 10,
    padding: 14,
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  produitCardDisabled: { opacity: 0.45, cursor: "not-allowed" },
  produitCardNom: { fontWeight: 600, fontSize: 13.5 },
  produitCardCat: { fontSize: 11, color: COL.inkSoft },
  produitCardFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  produitCardPrix: { fontWeight: 700, fontSize: 14 },
  produitCardStock: { fontSize: 11, color: COL.green },
  produitCardStockNul: { fontSize: 11, color: COL.red },

  panierPanel: { display: "none" },
  fabPanier: {
    position: "fixed",
    bottom: 20,
    left: 16,
    right: 16,
    background: COL.red,
    color: "#fff",
    border: "none",
    borderRadius: 14,
    padding: "16px 20px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(184,67,47,0.4)",
    zIndex: 30,
    fontFamily: "inherit",
  },
  panierDrawerMobile: {
    background: COL.bgPanel,
    borderRadius: "18px 18px 0 0",
    padding: "16px 22px 28px",
    width: "100%",
    maxWidth: 500,
    maxHeight: "85vh",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
  },

  panierVide: { color: COL.inkSoft, fontSize: 13.5, margin: "16px 0" },
  panierLignes: { display: "flex", flexDirection: "column", gap: 12, margin: "14px 0" },
  panierLigne: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  panierLigneNom: { fontSize: 13.5, fontWeight: 600 },
  panierLigneSub: { fontSize: 11, color: COL.inkSoft },
  panierLigneTotal: { fontSize: 13.5, fontWeight: 700, minWidth: 56, textAlign: "right" },
  qteControl: { display: "flex", alignItems: "center", gap: 6, background: "#EDE3D2", borderRadius: 8, padding: 4 },
  qteBtn: { border: "none", background: "#fff", width: 26, height: 26, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: COL.ink },
  qteVal: { fontSize: 13, fontWeight: 700, minWidth: 18, textAlign: "center" },

  panierTotalRow: { display: "flex", justifyContent: "space-between", fontSize: 16, borderTop: `1px solid ${COL.border}`, paddingTop: 12, marginTop: 4 },

  toast: {
    position: "fixed",
    bottom: 90,
    left: 16,
    right: 16,
    background: COL.ink,
    color: "#fff",
    padding: "13px 18px",
    borderRadius: 10,
    fontSize: 13.5,
    display: "flex",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
    zIndex: 100,
    justifyContent: "center",
  },
  toastWarn: { background: COL.yellow, color: COL.ink },

  factureModal: {
    background: "#fff",
    borderRadius: "16px 16px 0 0",
    padding: 24,
    width: "100%",
    maxWidth: 420,
    position: "relative",
    fontFamily: "'Courier New', monospace",
    color: COL.ink,
    maxHeight: "88vh",
    overflowY: "auto",
  },
  ticketHeader: { textAlign: "center", borderBottom: "2px dashed #2B2420", paddingBottom: 12, marginBottom: 12 },
  ticketBrand: { fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 18, letterSpacing: 1 },
  ticketSub: { fontSize: 12, color: COL.inkSoft },
  ticketClient: { fontSize: 12.5, marginBottom: 10 },
  ticketTable: { width: "100%", borderCollapse: "collapse", margin: "8px 0" },
  ticketTh: { textAlign: "left", fontSize: 11, padding: "4px 0" },
  ticketTd: { fontSize: 12.5, padding: "4px 0" },
  ticketTotalRow: { display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15, borderTop: "2px dashed #2B2420", paddingTop: 10, marginTop: 6 },
  stamp: { display: "inline-block", color: COL.red, border: `3px solid ${COL.red}`, padding: "4px 16px", marginTop: 16, fontWeight: 700, letterSpacing: 2, transform: "rotate(-6deg)", fontFamily: "Georgia, serif" },
};
