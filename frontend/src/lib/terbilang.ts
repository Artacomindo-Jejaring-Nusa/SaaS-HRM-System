/**
 * Indonesian Terbilang Helper
 */
export const terbilang = (nominal: number): string => {
  if (nominal === 0) return "Nol Rupiah";
  const angka = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  
  const konversi = (n: number): string => {
    if (n < 12) return angka[n];
    if (n < 20) return konversi(n - 10) + " Belas";
    if (n < 100) return konversi(Math.floor(n / 10)) + " Puluh " + konversi(n % 10);
    if (n < 200) return "Seratus " + konversi(n - 100);
    if (n < 1000) return konversi(Math.floor(n / 100)) + " Ratus " + konversi(n % 100);
    if (n < 2000) return "Seribu " + konversi(n - 1000);
    if (n < 1000000) return konversi(Math.floor(n / 1000)) + " Ribu " + konversi(n % 1000);
    if (n < 1000000000) return konversi(Math.floor(n / 1000000)) + " Juta " + konversi(n % 1000000);
    if (n < 1000000000000) return konversi(Math.floor(n / 1000000000)) + " Milyar " + konversi(n % 1000000000);
    return "";
  };
  
  let hasil = konversi(Math.floor(nominal));
  hasil = hasil.replaceAll(/\s+/g, ' ').trim();
  hasil = hasil.replaceAll("Satu Ratus", "Seratus").replaceAll("Satu Puluh", "Sepuluh").replaceAll("Satu Ribu", "Seribu");
  return hasil + " Rupiah";
};
