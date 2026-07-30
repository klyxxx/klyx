export default function Hero() {
  return (
    <section className="flex flex-col items-center justify-center text-center px-6 py-32">

      <span className="bg-blue-600/20 text-blue-400 px-5 py-2 rounded-full mb-8">
        🚀 La nouvelle génération du e-commerce
      </span>

      <h2 className="text-6xl font-extrabold max-w-5xl">
        Créez votre boutique
        <br />
        en quelques minutes.
      </h2>

      <p className="text-gray-400 text-xl max-w-3xl mt-8">
        Lancez votre boutique sans écrire une seule ligne de code.
      </p>

      <div className="flex gap-5 mt-12">
        <button className="bg-blue-600 px-8 py-4 rounded-xl">
          🚀 Commencer gratuitement
        </button>

        <button className="border border-gray-700 px-8 py-4 rounded-xl">
          Découvrir
        </button>
      </div>

    </section>
  );
}