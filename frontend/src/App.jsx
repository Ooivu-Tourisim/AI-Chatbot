import AuraChat from "./AuraChat.jsx";

// Placeholder host page. Delete this file once your real site exists —
// the only line that matters is <AuraChat />, mounted once at app level.
export default function App() {
  return (
    <>
      <main className="host">
        <h1>Your tourism platform</h1>
        <p>
          This page is a stand-in for the site you're building. It exists so the
          assistant has somewhere to live while you test it.
        </p>
        <p className="host-note">
          Aura sits in the bottom-right corner. Replace everything above with
          your real pages and keep the component below.
        </p>
      </main>

      <AuraChat />
    </>
  );
}
