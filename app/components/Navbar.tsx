export default function Navbar() {
  return (
    <header className="border-b border-gray-800">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-8 py-5">
        <h1 className="text-3xl font-bold text-white">KLYX</h1>

        <nav className="hidden md:flex gap-10 text-gray-300">
          <a href="#">Accueil</a>
          <a href="#features">Fonctionnalités</a>
          <a href="#pricing">Tarifs</a>
          <a href="#contact">Contact</a>
        </nav>

        <button className="bg-blue-600 px-6 py-3 rounded-xl text-white font-semibold">
          Se connecter
        </button>
      </div>
    </header>
  );
}