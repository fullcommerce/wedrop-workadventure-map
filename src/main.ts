/// <reference types="@workadventure/iframe-api-typings" />

import { bootstrapExtra } from "@workadventure/scripting-api-extra";

// Tipos para o sistema de reserva de mesas
type DeskOccupant = { name: string; since: number };
type PlayerPosition = { x: number; y: number };

// Extensão do tipo RoomState para incluir nossas variáveis
declare module "@workadventure/iframe-api-typings" {
    interface RoomState {
        desks: Record<string, DeskOccupant | null>;
        playerPositions: Record<string, PlayerPosition>;
    }
}

console.log('Script started successfully');

let currentPopup: any = undefined;
let currentDeskPopup: any = undefined;
let currentDeskMessage: any = undefined;
let isPopupOpen = false; // Flag para controlar se há popup aberto

// Funções utilitárias para gerenciar o estado das mesas
const getDesks = () => (WA.state.desks ?? {}) as Record<string, DeskOccupant | null>;
const saveDesks = (next: Record<string, DeskOccupant | null>) =>
  WA.state.saveVariable("desks", next);

// Funções utilitárias para gerenciar posições dos jogadores
const getPlayerPositions = () => (WA.state.playerPositions ?? {}) as Record<string, PlayerPosition>;
const savePlayerPositions = (next: Record<string, PlayerPosition>) =>
  WA.state.saveVariable("playerPositions", next);

// Função para salvar a posição atual do jogador
const saveCurrentPlayerPosition = async () => {
    const position = await WA.player.getPosition();
    const playerName = WA.player.name;
    const positions = getPlayerPositions();
    
    positions[playerName] = { x: position.x, y: position.y };
    savePlayerPositions(positions);
    console.log(`💾 Posição salva para ${playerName}: x=${position.x}, y=${position.y}`);
};

// Função segura para fechar popup
const safeClosePopup = (popup: any, context: string) => {
    if (!popup) {
        console.log(`ℹ️ Popup já estava fechado (${context})`);
        return;
    }
    
    try {
        popup.close();
        console.log(`✅ Popup fechado com sucesso (${context})`);
    } catch (e) {
        console.log(`⚠️ Erro ao fechar popup (${context}):`, e);
    }
};

// Função segura para remover mensagem
const safeRemoveMessage = (message: any, context: string) => {
    if (!message) {
        console.log(`ℹ️ Mensagem já estava removida (${context})`);
        return;
    }
    
    try {
        message.remove();
        console.log(`✅ Mensagem removida com sucesso (${context})`);
    } catch (e) {
        console.log(`⚠️ Erro ao remover mensagem (${context}):`, e);
    }
};

// Função para restaurar a posição do jogador
const restorePlayerPosition = () => {
    const playerName = WA.player.name;
    const positions = getPlayerPositions();
    const savedPosition = positions[playerName];
    
    if (savedPosition) {
        WA.player.moveTo(savedPosition.x, savedPosition.y);
        console.log(`🔄 Posição restaurada para ${playerName}: x=${savedPosition.x}, y=${savedPosition.y}`);
    } else {
        console.log(`ℹ️ Nenhuma posição salva encontrada para ${playerName}`);
    }
};

// Função para mostrar popup de reserva de mesa
const showDeskReservationPopup = (areaName: string) => {
  // Evita abrir múltiplos popups simultaneamente
  if (isPopupOpen) {
    console.log("⚠️ Popup já está aberto, ignorando nova tentativa");
    return;
  }

  const desks = getDesks();
  const me = WA.player.name;
  const isMine = desks[areaName]?.name === me;

  if (!desks[areaName]) {
    // Mesa disponível - mostra popup para reservar
    const currentAreaName = areaName; // Captura a variável no escopo
    
    // Verifica se o usuário já tem uma mesa
    const current = getDesks();
    const hasCurrentDesk = Object.keys(current).some(deskKey => current[deskKey]?.name === me);
    
    const popupMessage = hasCurrentDesk 
      ? "Você deseja mudar sua mesa para cá? A antiga será liberada"
      : "Você deseja tornar essa mesa sua?";
    
    // Fecha popup anterior se existir
    safeClosePopup(currentDeskPopup, "popup anterior");
    
    isPopupOpen = true; // Marca que há popup aberto
    console.log(`🆕 Abrindo popup para área: ${areaName}`);
    
    currentDeskPopup = WA.ui.openPopup(
      `${areaName}-available-popup`,
      popupMessage,
      [
        {
          label: "Sim",
          className: "primary",
          callback: async (popup) => {
            console.log("🟢 Botão SIM clicado para mesa:", currentAreaName);
            try {
              const current = getDesks();
              const now = Date.now();
              
              console.log("📊 Estado atual das mesas:", current);
              
              // Libera mesa antiga do usuário (se existir)
              Object.keys(current).forEach(deskKey => {
                if (current[deskKey]?.name === me) {
                  console.log("🔄 Liberando mesa antiga:", deskKey);
                  current[deskKey] = null;
                }
              });
              
              // Reserva nova mesa
              current[currentAreaName] = { name: me, since: now };
              console.log("✅ Reservando nova mesa:", currentAreaName);
              
              await saveDesks(current);
              console.log("💾 Estado salvo com sucesso");
              
              // Fecha o popup após salvar
              safeClosePopup(popup, "botão SIM");
              currentDeskPopup = null;
              isPopupOpen = false; // Reseta a flag
            } catch (e) {
              console.log("❌ Erro ao reservar mesa:", e);
              isPopupOpen = false; // Reseta a flag mesmo com erro
            }
          }
        },
        {
          label: "Não",
          className: "normal",
          callback: (popup) => {
            console.log("🔴 Botão NÃO clicado para mesa:", currentAreaName);
            safeClosePopup(popup, "botão NÃO");
            currentDeskPopup = null;
            isPopupOpen = false; // Reseta a flag
          }
        }
      ]
    );
  } else if (!isMine) {
    // Mesa ocupada por outro usuário - mostra mensagem informativa
    const occupant = desks[areaName]!;
    const timeSince = Math.floor((Date.now() - occupant.since) / 1000 / 60); // minutos
    const timeText = timeSince < 1 ? "menos de 1 minuto" : 
                    timeSince === 1 ? "1 minuto" : 
                    `${timeSince} minutos`;
    
    // Remove mensagem anterior se existir
    safeRemoveMessage(currentDeskMessage, "mensagem anterior");
    
    currentDeskMessage = WA.ui.displayPlayerMessage({
      message: `Essa mesa é do(a) ${occupant.name} desde ${timeText} atrás`,
      callback: () => {
        // Não faz nada, apenas informativo
      }
    });
  }
  // Não mostra nada para própria mesa
};

// Waiting for the API to be ready
WA.onInit().then(() => {
    console.log('Scripting API ready');
    console.log('Player tags: ',WA.player.tags)

    // Restaura a posição do jogador ao entrar
    restorePlayerPosition();

    // Sistema de relógio existente
    WA.room.area.onEnter('clock').subscribe(() => {
        const today = new Date();
        const time = today.getHours() + ":" + today.getMinutes();
        currentPopup = WA.ui.openPopup("clockPopup", "It's " + time, []);
    })

    WA.room.area.onLeave('clock').subscribe(closePopup)

    // Sistema de reserva de mesas
    const deskAreas = [
      "desk-01", "desk-02", "desk-03", "desk-04", "desk-05",
      "desk-06", "desk-07", "desk-08", "desk-09", "desk-10",
      "desk-11", "desk-12", "desk-13", "desk-14", "desk-15",
      "desk-16", "desk-17", "desk-18", "desk-19", "desk-20",
      "desk-21", "desk-22", "desk-23", "desk-24", "desk-25",
      "desk-26", "desk-27", "desk-28", "desk-29", "desk-30",
      "desk-31", "desk-32", "desk-33", "desk-34", "desk-35",
      "desk-36", "desk-37", "desk-38", "desk-39", "desk-40",
      "desk-41", "desk-42", "desk-43", "desk-44", "desk-45",
      "desk-46", "desk-47", "desk-48", "desk-49", "desk-50"
    ]; // 50 áreas de mesa disponíveis

    deskAreas.forEach((areaName) => {
      // Ao entrar na área da mesa
      WA.room.area.onEnter(areaName).subscribe(() => {
        console.log(`🚶 Entrou na área: ${areaName}`);
        // Pequeno delay para evitar conflitos
        setTimeout(() => {
          showDeskReservationPopup(areaName);
        }, 100);
      });

      // Ao sair da área da mesa - fecha o popup e mensagem
      WA.room.area.onLeave(areaName).subscribe(() => {
        console.log(`🚶 Saiu da área: ${areaName}`);
        // Fecha imediatamente ao sair da área
        // Fecha o popup da mesa se estiver aberto
        if (currentDeskPopup) {
          safeClosePopup(currentDeskPopup, `área ${areaName}`);
          currentDeskPopup = null;
          isPopupOpen = false; // Reseta a flag
        }
        
        // Remove a mensagem se estiver visível
        if (currentDeskMessage) {
          safeRemoveMessage(currentDeskMessage, `área ${areaName}`);
          currentDeskMessage = null;
        }
      });

      console.log('Desk area: ',areaName)
    });

    // Teste: verificar se as variáveis existem
    console.log("=== TESTE DE VARIÁVEIS ===");
    try {
      const testDesks = getDesks();
      console.log("✅ Variável 'desks' encontrada:", testDesks);
    } catch (e) {
      console.log("❌ Variável 'desks' NÃO encontrada:", e);
      console.log("💡 Crie um objeto no Tiled com nome 'desks' e tipo 'variable'");
    }
    
    try {
      const testPositions = getPlayerPositions();
      console.log("✅ Variável 'playerPositions' encontrada:", testPositions);
    } catch (e) {
      console.log("❌ Variável 'playerPositions' NÃO encontrada:", e);
      console.log("💡 Crie um objeto no Tiled com nome 'playerPositions' e tipo 'variable'");
    }
    console.log("=== FIM DO TESTE ===");

    // Listener para mudanças no estado das mesas (atualização em tempo real)
    WA.state.onVariableChange("desks").subscribe(() => {
      console.log("🔄 Estado das mesas atualizado");
    });

    // Salva a posição do jogador periodicamente (a cada 5 segundos)
    setInterval(() => {
        saveCurrentPlayerPosition();
    }, 5000);

    // Salva a posição quando o jogador se move
    WA.player.onPlayerMove(() => {
        saveCurrentPlayerPosition();
    });

    // The line below bootstraps the Scripting API Extra library that adds a number of advanced properties/features to WorkAdventure
    bootstrapExtra().then(() => {
        console.log('Scripting API Extra ready');
        
        // Adiciona botão "Ir para a mesa" no ActionsMenu
        WA.ui.actionBar.addButton({
            id: 'go-to-desk',
            type: 'action',
            imageSrc: 'https://img.icons8.com/ios/50/000000/desk.png',
            toolTip: 'Ir para minha mesa',
            callback: () => {
                const desks = getDesks();
                const me = WA.player.name;
                
                // Encontra a mesa do usuário
                const myDesk = Object.keys(desks).find(deskKey => desks[deskKey]?.name === me);
                
                if (myDesk) {
                    console.log(`🚀 Indo para minha mesa: ${myDesk}`);
                    
                    // Mostra popup com informações da mesa
                    WA.ui.openPopup(
                        'my-desk-info',
                        `Sua mesa é: ${myDesk}`,
                        [
                            {
                                label: "Ir para a mesa",
                                className: "primary",
                                callback: () => {
                                    // Mostra instruções de navegação
                                    console.log(`🚀 Navegando para ${myDesk}`);
                                    WA.ui.displayPlayerMessage({
                                        message: `Navegue até a área ${myDesk} para gerenciar sua mesa.`,
                                        callback: () => {}
                                    });
                                }
                            },
                            {
                                label: "Liberar mesa",
                                className: "normal",
                                callback: async () => {
                                    const current = getDesks();
                                    current[myDesk] = null;
                                    await saveDesks(current);
                                    console.log(`Mesa ${myDesk} liberada`);
                                }
                            }
                        ]
                    );
                } else {
                    console.log("❌ Você não tem uma mesa reservada");
                    // Mostra mensagem informativa
                    WA.ui.displayPlayerMessage({
                        message: "Você não tem uma mesa reservada",
                        callback: () => {
                            // Não faz nada, apenas informativo
                        }
                    });
                }
            }
        });
        
    }).catch(e => console.error(e));

}).catch(e => console.error(e));

function closePopup(){
    if (currentPopup !== undefined) {
        currentPopup.close();
        currentPopup = undefined;
    }
}

export {};