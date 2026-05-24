# Istruzioni per accedere al Database di Produzione ICBK

## Cos'è questo servizio

Un proxy read-only che ti permette di LEGGERE i dati dal database di produzione ICBK. Non puoi scrivere, modificare o cancellare nulla — qualsiasi tentativo viene bloccato automaticamente.

## Autenticazione

Ogni richiesta deve includere l'header `x-api-key` con la chiave API. La chiave ti verrà fornita separatamente dall'utente. Non salvarla, non loggarla, non includerla in nessun file.

## Base URL

```
https://collegamento-db-produzione-icbk.vercel.app
```

---

## Endpoint disponibili

### 1. Health Check

```
GET /api/health
```

Verifica che il database sia raggiungibile. Non richiede API key.

---

### 2. Lista Tabelle

```
GET /api/tables
Headers: x-api-key: <API_KEY>
```

Restituisce tutte le tabelle disponibili nel database.

---

### 3. Ordini (ENDPOINT PRINCIPALE)

```
GET /api/orders
Headers: x-api-key: <API_KEY>
```

Restituisce gli ordini completi con tutti i dati collegati: prodotti, pagamenti, clienti, driver, fatture.

#### Filtri disponibili (tutti opzionali):

| Parametro | Descrizione | Esempio |
|-----------|-------------|---------|
| `date` | Data di consegna esatta | `?date=2026-05-24` |
| `from` | Data inizio intervallo | `?from=2026-05-01` |
| `to` | Data fine intervallo | `?to=2026-05-31` |
| `status` | Stato ordine | `?status=delivered` |
| `driver` | Nome driver (ricerca parziale) | `?driver=ahmed` |
| `customer` | Nome cliente (ricerca parziale) | `?customer=SHAKA` |
| `limit` | Max risultati (default 500, max 2000) | `?limit=50` |
| `offset` | Paginazione | `?offset=100` |

I filtri si combinano: `?date=2026-05-24&status=confirmed&driver=ahmed`

#### Stati ordine possibili:
- `draft` — bozza
- `pending` — in attesa di conferma
- `confirmed` — confermato
- `delivered` — consegnato
- `cancelled` — cancellato

#### Struttura risposta per ogni ordine:

```json
{
  "order_id": "4NT43T689",
  "order_status": "delivered",
  "segment": "B2B",
  "currency": "EUR",

  "customer_id": "4NFCH93E3",
  "customer_name": "DA NONNA S.R.L.",
  "customer_has_outstanding_debt": true,
  "customer_outstanding_balance": 27,

  "delivery_date": "2026-05-09",
  "created_at": "2026-05-08T13:19:55.032Z",
  "last_update": "2026-05-09T17:46:35.884Z",
  "confirmed_at": "2026-05-09T06:01:54.576Z",
  "confirmed_by": "volpo",
  "cancelled_at": null,
  "cancelled_by": null,

  "products_summary": "1x Cons, 40x G",
  "products_detail": [
    {
      "product_id": "47VUC612J",
      "abbreviation": "G",
      "product_name": "Ghiaccio Gourmet",
      "product_code": "G-GB",
      "product_unit": "kg",
      "quantity": 40,
      "base_price": 0.5656,
      "net_price": 0.5656,
      "discount_percentage": 0
    }
  ],

  "timeslot": "2 - Metà Mattina - 10:30/12:30",
  "delivery_time": "[10:30 - 12:30]",
  "delivery_note": "[40x G]",
  "driver_id": "4NLX5U0TH",
  "driver_name": "ahmed",
  "truck_id": null,
  "shipping_address": "{...indirizzo JSON con via, città, CAP, coordinate GPS...}",
  "shipping_price": 6.89,
  "shipping_weight": 40,

  "contact_name": "Mirko",
  "telephone": "+39 320 180 4788",
  "delivery_instructions": "",
  "internal_note": "9-12 - salderà anche l'ordine insoluto",

  "taxable_amount": 29.514,
  "tax_percentage": 22,
  "tax_amount": 6.49,
  "total_amount": 36,

  "fatture_id": "524266176",
  "document_type": null,
  "document_number": null,
  "document_link": null,

  "last_payment_status": "Payed in cash",
  "last_payment_amount": 36,
  "payment_balance": 0,
  "payments": [
    {
      "payment_status": "Payed in cash",
      "amount": "36.0",
      "collected_by_id": "4NLX5U0TH",
      "collected_by_name": "Ahmed Fareed",
      "payment_date": "2026-05-09",
      "payment_created_at": "2026-05-09T17:46:35.869Z"
    }
  ]
}
```

#### Note importanti sui dati:

- **`customer_has_outstanding_debt`**: se `true`, il cliente ha insoluti pregressi (è il "triangolino" di alert). L'importo è in `customer_outstanding_balance`.
- **`products_summary`**: riepilogo veloce dei prodotti con abbreviazioni (es. "1x Cons, 40x G").
- **`products_detail`**: dettaglio completo di ogni prodotto con prezzi e sconti.
- **`payments`**: array — un ordine può avere più pagamenti. Ogni pagamento ha chi ha incassato (`collected_by_name`), lo stato, l'importo e la data.
- **`shipping_address`**: è un JSON stringificato con via, città, CAP, provincia, coordinate GPS.
- **`payment_balance`**: saldo residuo dell'ordine. Se 0, l'ordine è completamente pagato.
- **Stati pagamento comuni**: "Payed in cash", "POS", "Insoluto", "Conto 1", "Bonifico".

---

### 4. Query SQL personalizzata (uso avanzato)

```
POST /api/query
Headers: x-api-key: <API_KEY>
Content-Type: application/json

Body:
{
  "sql": "SELECT COUNT(*) FROM orders WHERE delivery_date = $1",
  "params": ["2026-05-24"]
}
```

Questo endpoint accetta SOLO query SELECT. Qualsiasi operazione di scrittura (INSERT, UPDATE, DELETE, DROP, ecc.) viene bloccata con errore 403.

Usare preferibilmente `/api/orders` quando possibile. Usare `/api/query` solo quando serve una query specifica non coperta dagli altri endpoint.

---

## Tabelle principali del database

| Tabella | Contenuto |
|---------|-----------|
| `orders` | Ordini (52 colonne) |
| `order_items` | Prodotti per ordine |
| `products` | Catalogo prodotti |
| `customers` | Anagrafica clienti |
| `customer_balances` | Saldi insoluti per cliente |
| `payments` | Pagamenti ricevuti |
| `timeslots` | Fasce orarie di consegna |
| `trucks` | Veicoli / driver |
| `users` | Utenti del sistema |
| `addresses` | Indirizzi |
| `contacts` | Contatti |
| `discounts` | Sconti |
| `expenses` | Spese |
| `fattura` | Fatture |
| `settings` | Impostazioni |

---

## Esempio di utilizzo da codice

```javascript
const API_KEY = "..."; // fornita separatamente
const BASE_URL = "https://collegamento-db-produzione-icbk.vercel.app";

// Ordini di oggi
const response = await fetch(`${BASE_URL}/api/orders?date=2026-05-24`, {
  headers: { "x-api-key": API_KEY }
});
const data = await response.json();
console.log(data.orders);
```

## Sicurezza

- Solo lettura — impossibile modificare i dati
- Autenticazione obbligatoria via API key
- Query di scrittura bloccate a livello applicativo E a livello PostgreSQL
- Non salvare mai la API key in file di codice
