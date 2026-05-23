export default function Home() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 700, margin: "60px auto", padding: "0 20px" }}>
      <h1>ICBK — Database Read-Only Proxy</h1>
      <p style={{ color: "#666", fontSize: 18 }}>
        Questo servizio fornisce accesso in <strong>sola lettura</strong> al
        database di produzione. Qualsiasi operazione di scrittura viene
        bloccata automaticamente.
      </p>

      <hr style={{ margin: "30px 0", border: "1px solid #eee" }} />

      <h2>Endpoints disponibili</h2>

      <h3><code>GET /api/health</code></h3>
      <p>Health check — verifica che il database sia raggiungibile. Non richiede API key.</p>

      <h3><code>GET /api/tables</code></h3>
      <p>Lista tutte le tabelle disponibili nel database.</p>
      <pre style={{ background: "#f5f5f5", padding: 16, borderRadius: 8, overflow: "auto" }}>
{`curl -H "x-api-key: YOUR_API_KEY" \\
  https://your-domain.vercel.app/api/tables`}
      </pre>

      <h3><code>POST /api/query</code></h3>
      <p>Esegue una query SELECT sul database. Le query di scrittura vengono bloccate.</p>
      <pre style={{ background: "#f5f5f5", padding: 16, borderRadius: 8, overflow: "auto" }}>
{`curl -X POST \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"sql": "SELECT * FROM orders LIMIT 10"}' \\
  https://your-domain.vercel.app/api/query`}
      </pre>

      <h3>Query con parametri</h3>
      <pre style={{ background: "#f5f5f5", padding: 16, borderRadius: 8, overflow: "auto" }}>
{`{
  "sql": "SELECT * FROM orders WHERE customer_id = $1 AND status = $2",
  "params": [42, "completed"]
}`}
      </pre>

      <hr style={{ margin: "30px 0", border: "1px solid #eee" }} />

      <h2>Sicurezza</h2>
      <ul style={{ lineHeight: 2 }}>
        <li>Autenticazione via <code>x-api-key</code> header</li>
        <li>Solo query <code>SELECT</code> permesse</li>
        <li>Blocco keyword di scrittura (INSERT, UPDATE, DELETE, DROP, ...)</li>
        <li>Transazioni PostgreSQL <code>READ ONLY</code></li>
        <li>Blocco statement multipli (anti SQL injection)</li>
      </ul>
    </div>
  );
}
