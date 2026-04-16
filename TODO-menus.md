# TODO: Menus Role-Based

**Atual:**
- Todos veem: Utilizadores, Inventario, Aulas, Marcacoes, Alugueres, Master

**Novo:**
```
DIREÇÃO/Geral (Permissoes alto): TUDO
PROFESSOR.silva (123456): 
  - Suas aulas (GET minhas aulas)
  - Disponibilidade (criar/editar)
  - Suas marcacoes
```

**Próximos passos:**
1. Identificar Permissoes professor vs direção
2. API endpoints para "minhas aulas"/disponibilidade
3. TestsBackend condicional baseado user.Permissoes

