export function onlyDigits(v: string) {
  return (v || "").replace(/\D+/g, "");
}

export function isValidCPF(cpfRaw: string): boolean {
  const c = onlyDigits(cpfRaw);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;

  let s = 0;
  for (let i = 1; i <= 9; i++) {
    s += parseInt(c.substring(i - 1, i)) * (11 - i);
  }
  let r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(c.substring(9, 10))) return false;

  s = 0;
  for (let i = 1; i <= 10; i++) {
    s += parseInt(c.substring(i - 1, i)) * (12 - i);
  }
  r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;

  return r === parseInt(c.substring(10, 11));
}

export function isValidCNPJ(cnpjRaw: string): boolean {
  const c = onlyDigits(cnpjRaw);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;

  const calc = (b: string, f: number[]) =>
    f.reduce((a, x, i) => a + parseInt(b[i]) * x, 0);

  let b = c.slice(0, 12);
  let d1 = 11 - (calc(b, [5,4,3,2,9,8,7,6,5,4,3,2]) % 11);
  d1 = d1 >= 10 ? 0 : d1;

  b += d1;
  let d2 = 11 - (calc(b, [6,5,4,3,2,9,8,7,6,5,4,3,2]) % 11);
  d2 = d2 >= 10 ? 0 : d2;

  return c === b + String(d2);
}

export function isValidCpfCnpj(v: string): boolean {
  const d = onlyDigits(v);
  if (!d) return false;

  if (d.length === 11) return isValidCPF(d);
  if (d.length === 14) return isValidCNPJ(d);

  return false;
}
