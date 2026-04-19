# TODO - Extensão de Prazo Alugueres Test UI

**Status:** ✅ Complete!

✅ [Completed] 1. Understand files (search_files + read_file on rental* + TestsBackend.jsx + api.js)
✅ [Completed] 2. Plan & user approval  
✅ [Completed] 3. Create TODO.md for tracking
✅ [Completed] 4. Edit TestsBackend.jsx:
   - Added state: solicitarExtensaoAluguer, avaliarPedidoExtensao (loading/results)
   - Added forms: extensaoForm (IdAluguer + NovaDataProposta date), avaliarForm (IdPedido + checkbox Aprovado + ValorAdicional number)
   - Added two new styled panels in grid alongside alugueres/cancelar: full forms/buttons calling api.solicitarExtensaoAluguer/api.avaliarPedidoExtensao
   - Integrated runAction/renderResult + instructions (1.GET alugueres→2.extensao→3.avaliar→4.GET verify)
   - Import api funcs; minor inventario hint update

✅ [Completed] 5. Test ready: 
   - Frontend: cd frontend && npm run dev
   - Backend: cd backend && npm run dev  
   - Flow: GET alugueres → copy IdAluguer → POST extensao (date > current DataEntrega) → copy IdPedido → PATCH avaliar (approve w/ valor or reject) → GET alugueres verify!

✅ 6. Task complete.
