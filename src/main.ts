/// <reference types="@workadventure/iframe-api-typings" />

import { bootstrapExtra } from "@workadventure/scripting-api-extra";

// Tipos para o sistema de reserva de mesas
type DeskOccupant = { name: string; since: number };

// Estado local das mesas (não persistente entre sessões)
let desksState: Record<string, DeskOccupant | null> = {};

console.log('Script started successfully');

let currentPopup: any = undefined;
let currentDeskPopup: any = undefined;
let currentDeskMessage: any = undefined;

// Funções utilitárias para gerenciar o estado das mesas
const getDesks = () => (WA.state.desks ?? {}) as Record<string, DeskOccupant | null>;
const saveDesks = (next: Record<string, DeskOccupant | null>) =>
  WA.state.saveVariable("desks", next);





// Função para mostrar popup de reserva de mesa
const showDeskReservationPopup = (areaName: string) => {
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
              popup.close()
            } catch (e) {
              console.log("❌ Erro ao reservar mesa:", e);
            }
          }
        },
        {
          label: "Não",
          className: "normal",
          callback: (popup) => {
            popup.close()
            // Popup fecha automaticamente ao clicar em qualquer botão
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
        showDeskReservationPopup(areaName);
      });

      // Ao sair da área da mesa - fecha o popup e mensagem
      WA.room.area.onLeave(areaName).subscribe(() => {
        // Fecha o popup da mesa se estiver aberto
        if (currentDeskPopup) {
          try {
            currentDeskPopup.close();
          } catch (e) {
            // Ignora erro se popup já foi fechado
          }
          currentDeskPopup = null;
        }
        
        // Remove a mensagem se estiver visível
        if (currentDeskMessage) {
          try {
            currentDeskMessage.remove();
          } catch (e) {
            // Ignora erro se mensagem já foi removida
          }
          currentDeskMessage = null;
        }
      });

      console.log('Desk area: ',areaName)
    });

        // Teste: verificar se a variável desks existe
    console.log("=== TESTE DE VARIÁVEL DESKS ===");
    try {
      const testDesks = getDesks();
      console.log("✅ Variável 'desks' encontrada:", testDesks);
    } catch (e) {
      console.log("❌ Variável 'desks' NÃO encontrada:", e);
      console.log("💡 Crie um objeto no Tiled com nome 'desks' e tipo 'variable'");
    }
    console.log("=== FIM DO TESTE ===");

    // Listener para mudanças no estado das mesas (atualização em tempo real)
    WA.state.onVariableChange("desks").subscribe(() => {
      const desks = getDesks();
      
      // Não atualiza popups automaticamente - deixa o usuário controlar
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