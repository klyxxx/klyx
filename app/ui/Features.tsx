export default function Features() {
  return (
    <section
      id="features"
      className="max-w-7xl mx-auto py-24 px-8 text-foreground dark:text-white"
    >
      <h2 className="text-4xl font-bold text-center mb-12">
        Pourquoi choisir KLYX ?
      </h2>

      <div className="grid md:grid-cols-3 gap-8">

        <div className="bg-card dark:bg-zinc-900 p-8 rounded-2xl">
          <h3 className="text-2xl font-bold mb-3">
            🛍️ Boutique instantanée
          </h3>

          <p className="text-gray-400">
            Créez votre boutique en moins de 5 minutes.
          </p>
        </div>

        <div className="bg-card dark:bg-zinc-900 p-8 rounded-2xl">
          <h3 className="text-2xl font-bold mb-3">
            📈 Tableau de bord
          </h3>

          <p className="text-gray-400">
            Gérez commandes, produits et statistiques.
          </p>
        </div>

        <div className="bg-card dark:bg-zinc-900 p-8 rounded-2xl">
          <h3 className="text-2xl font-bold mb-3">
            💳 Paiement sécurisé
          </h3>

          <p className="text-gray-400">
            Stripe et PayPal intégrés.
          </p>
        </div>

      </div>
    </section>
  );
}