# TODO: Fix TestsBackend Rental Tests

## Plan Breakdown
- [x] 1. Add GET Inventario button to Alugueres panel ✅
- [x] 2. Fix aluguerForm.ListaArtigosJson initial value with valid JSON example ✅
- [x] 3. Add try-catch for JSON.parse in create rental onSubmit ✅
- [x] 4. Improve textarea label/placeholder ✅
- [ ] Test flow: 1. Frontend reload → GET Inventario (stock>0 IdTamanhoArtigo) → JSON → POST Criar aluguer → GET Alugueres ✅
- [ ] cd backend && npx prisma studio → verify TamanhoArtigo.Quantidade >0

**Next: Test after frontend reload!**

