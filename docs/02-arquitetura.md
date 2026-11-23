# Arquitetura -- Real Valor
Regras principais (.clinerules):
- R-A: lib nao importa modules (5 casos verificados, 3 restantes apos F1)
- R-B: lib/modules nao importam app
- R-C: fora de lib/data, lib nao importa lib/data (1 caso vivo)
- R-D: checkout conhece pagamento apenas por @lib/payments
- R-E: sem ciclo de imports de valor
