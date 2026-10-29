/**
 * En Render a veces quedan dos procesos vivos. Los dos abrirían
 * la misma sesión y WhatsApp se desvincula. Este turno deja uno solo.
 */
const fs = require("fs");
const path = require("path");

function esperarTurno(archivo, avisar) {
  let timer = null;
  let mio = false;

  function soltar() {
    mio = false;
    if (timer) clearInterval(timer);
    timer = null;
    try {
      const actual = JSON.parse(fs.readFileSync(archivo, "utf8"));
      if (actual && actual.pid === process.pid) fs.unlinkSync(archivo);
    } catch (_) {}
  }

  async function tomar() {
    fs.mkdirSync(path.dirname(archivo), { recursive: true });
    let avisado = false;
    for (;;) {
      try {
        fs.writeFileSync(archivo, JSON.stringify({ pid: process.pid, t: Date.now() }), { flag: "wx" });
        mio = true;
        timer = setInterval(() => {
          if (!mio) return;
          try {
            fs.writeFileSync(archivo, JSON.stringify({ pid: process.pid, t: Date.now() }));
          } catch (_) {}
        }, 5000);
        if (avisar) avisar("mio");
        return soltar;
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        let t = 0;
        try {
          t = JSON.parse(fs.readFileSync(archivo, "utf8")).t || 0;
        } catch (_) {}
        if (!t || Date.now() - t > 20000) {
          try {
            fs.unlinkSync(archivo);
          } catch (_) {}
          continue;
        }
        if (!avisado && avisar) {
          avisar("espero");
          avisado = true;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  return tomar();
}

module.exports = { esperarTurno };
