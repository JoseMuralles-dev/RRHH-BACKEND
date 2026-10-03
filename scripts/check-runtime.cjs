const [major, minor] = process.versions.node.split('.').map(Number);
const supported = (major === 20 && minor >= 19) ||
  (major === 22 && minor >= 12) || major > 22;

if (!supported) {
  console.error(
    `Node ${process.versions.node} no es compatible con este backend. ` +
    'Usa Node 20.19+ (rama 20) o Node 22.12+. Se recomienda la rama 22.\n' +
    'Para iniciar temporalmente con Node 22 sin cambiar tu instalacion global:\n' +
    'npx --yes --package=node@22 -c "npm run start:dev"',
  );
  process.exit(1);
}
