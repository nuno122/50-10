
const API_BASE_URL = 'http://localhost:3000'; 

export const testarUtilizadores = async () => {
    try {
      
        const response = await fetch(`${API_BASE_URL}/utilizadores`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Erro no pedido: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error("Erro ao contactar o backend:", error);
        throw error;
    }
};