(function (document, window, $, settings) {

  var app = {

    fadeDuration: 200,

    init: function () {

      // Do that when DOM is ready.
      $(document).ready(app.ready);
    },

    ready: function () {

      app.$holder = $('body');

      app.bindActions();
      app.initNotifyboxes();
      app.shortcodes.init();
    },

    bindActions: function () {

      app.$holder
        .on('click', '.epsilon-notifybox__close', app.handleCloseClick)
        .on('click', '.epsilon-notifybox-closed__icon', app.handleClosedIconClick);

      // Analytics
      app.$holder
        .on('enb-display-notifybox', app.analytics.onDisplay)
        .on('enb-open-notifybox', app.analytics.onDisplay)
        .on('enb-close-notifybox', app.analytics.onClose)
        .on('enb-notifybox-activated', app.analytics.onActivated);

      // Visibility
      app.$holder
        .on('enb-display-notifybox', app.visibility.onDisplay)
        .on('enb-close-notifybox', app.visibility.onClose)
        .on('enb-notifybox-activated', app.visibility.onActivated);
    },

    initNotifyboxes: function () {

      $('.epsilon-notifybox').each(function () {

        var $self = $(this),
          id = $self.data('id'),
          $closedHolder = $('#epsilon-notifybox-closed-' + id),
          notifybox = settings.notifyboxes[id],
          visibility = app.visibility.getVisibility(id);

        if (visibility === 'hidden') {
          $self.hide();
          return;
        }

        if (
          (notifybox.displayCapability === 'logged-in' && !app.isUserLoggedIn()) ||
          (notifybox.displayCapability === 'non-logged-in' && app.isUserLoggedIn())
        ) {
          $self.hide();
          return;
        }

        var currentDate = Math.floor(Date.now() / 1000);

        if (
          notifybox.displayStartDate !== false &&
          Number(notifybox.displayStartDate) > currentDate
        ) {
          $self.hide();
          return;
        }

        if (
          notifybox.displayEndDate !== false &&
          Number(notifybox.displayEndDate) < currentDate
        ) {
          $self.hide();
          return;
        }

        setTimeout(function () {

          if (visibility === 'closed') {
            if ($closedHolder.length > 0) {
              $self.hide().removeClass('epsilon-notifybox-hidden');
              $closedHolder.fadeIn(app.fadeDuration);
            }
          } else {
            $self.removeClass('epsilon-notifybox-hidden')
          }

          app.$holder.trigger('enb-display-notifybox', [id]);

        }, notifybox.displayDelay);

      });
    },

    handleCloseClick: function () {
      app.closeNotifybox($(this).closest('.epsilon-notifybox').data('id'));
    },

    handleClosedIconClick: function () {
      app.openNotifybox($(this).closest('.epsilon-notifybox-closed').data('id'))
    },

    closeNotifybox: function (id) {

      var $holder = $('#epsilon-notifybox-' + id),
        $closedHolder = $('#epsilon-notifybox-closed-' + id);

      $holder.fadeOut(app.fadeDuration, function () {
        if ($closedHolder.length > 0) {
          $closedHolder.fadeIn(app.fadeDuration);
        }
      });

      app.$holder.trigger('enb-close-notifybox', [id]);
    },

    openNotifybox: function (id) {

      var $holder = $('#epsilon-notifybox-' + id),
        $closedHolder = $('#epsilon-notifybox-closed-' + id);

      if ($closedHolder.length > 0) {
        $closedHolder.fadeOut(app.fadeDuration, function () {
          $holder.fadeIn(app.fadeDuration);
        });
      } else {
        $holder.fadeIn(app.fadeDuration);
      }

      app.$holder.trigger('enb-open-notifybox', [id]);
    },

    visibility: {

      onDisplay: function (e, id) {

        var notifybox = settings.notifyboxes[id];

        if (
          notifybox.displayFrequency === 'once' ||
          notifybox.displayFrequency === 'once_per_day'
        ) {
          app.visibility.setVisibility(id, 'closed', notifybox.displayFrequency);
        }
      },

      onClose: function (e, id) {

        var notifybox = settings.notifyboxes[id];

        if (
          notifybox.displayFrequency === 'once_until_closed' ||
          notifybox.displayFrequency === 'once_until_closed_or_activated'
        ) {
          app.visibility.setVisibility(id, 'closed', notifybox.displayFrequency);
        }
      },

      onActivated: function (e, id) {

        var notifybox = settings.notifyboxes[id];

        if (
          notifybox.displayFrequency === 'once_until_activated' ||
          notifybox.displayFrequency === 'once_until_closed_or_activated'
        ) {
          app.visibility.setVisibility(id, 'hidden', notifybox.displayFrequency);
        }

      },

      setVisibility: function (id, value, displayFrequency) {

        var nonExpireLifetime = 3600 * 24 * 365 * 100; // 100 years

        if (app.visibility.getVisibility(id) === 'hidden') {
          return;
        }

        switch (displayFrequency) {
          case 'once' :
          case 'once_until_closed' :
          case 'once_until_activated' :
          case 'once_until_closed_or_activated' :
            app.setCookie(app.visibility.getKey(id), value, {
              expires: nonExpireLifetime,
              path: '/'
            });
            break;
          case 'once_per_day' :
            app.setCookie(app.visibility.getKey(id), value, {
              expires: 3600 * 24, // one day
              path: '/'
            });
            break;
        }
      },

      getVisibility: function (id) {

        return app.getCookie(app.visibility.getKey(id));
      },

      getKey: function (id) {

        return 'epsilon-notifybox-visibility-' + id;
      },
    },

    analytics: {

      onDisplay: function (e, id) {

        app.analytics.fireNotifyboxEvent(id, 'Notifybox shown');
      },

      onClose: function (e, id) {

        app.analytics.fireNotifyboxEvent(id, 'Notifybox closed');
      },

      onActivated: function (e, id) {

        app.analytics.fireNotifyboxEvent(id, 'Notifybox activated');
      },

      fireNotifyboxEvent: function (id, action, label, value) {

        if (!settings.notifyboxes[id].gaActivate) {
          return;
        }

        var category = settings.notifyboxes[id].gaEventCategory;

        app.analytics.fireEvent(category, action, label, value);
      },

      fireEvent: function (category, action, label, value) {

        label = label || false;
        value = value || false;

        if (settings.isAdmin === '0') {
          if (window.ga !== undefined && typeof window.ga === 'function') {

            var args = {
              hitType: 'event',
              eventCategory: category,
              eventAction: action
            };

            if (label) {
              args['eventLabel'] = label;
            }

            if (value) {
              args['eventValue'] = value;
            }

            if (window.ga.getAll !== undefined && window.ga.getAll()[0].get('name')) {
              app.analytics._fireSendEvent(args);
            } else {
              window.ga(function () {
                setTimeout(function () {
                  app.analytics._fireSendEvent(args);
                }, 500);
              });
            }

          } else {
            console.log('Even is not triggered. Analytic library is missing.');
          }
        } else {
          console.log('Analytics even is not triggered in administrator mode. Event data:', {
            eventCategory: category,
            eventAction: action,
            eventLabel: label,
            eventValue: value
          });
        }
      },
      _fireSendEvent: function (args) {
        if (window.ga.getAll === undefined) {
          console.log('Even is not triggered. Analytic library error.');
          return;
        }

        var trackerName = window.ga.getAll()[0].get('name');
        window.ga(trackerName + '.send', args);
      }
    },

    shortcodes: {

      init: function () {

        app.shortcodes.closeLink.init();
        app.shortcodes.couponButton.init();
        app.shortcodes.countdown.init();

        if (window.wpcf7 !== undefined) {
          app.shortcodes.contactForm7.init();
        }
      },

      closeLink: {

        init: function () {

          $('.epsilon-notifybox .enb-close-link').click(function (e) {
            e.preventDefault();
            app.closeNotifybox($(this).closest('.epsilon-notifybox').data('id'));
          });
        }
      },
      couponButton: {

        init: function () {

          $('.epsilon-notifybox .enb-coupon-button').click(function (e) {

            var $self = $(this),
              $holder = $self.closest('.epsilon-notifybox'),
              id = $holder.data('id');

            $self.addClass('loading');

            $.ajax({
              type: 'POST',
              url: settings.ajaxUrl,
              data: {
                action: 'enb_apply_coupon',
                coupon_code: $self.data('coupon')
              },
              success: function (resp) {
                if (resp.success) {

                  $holder.find('.epsilon-notifybox__content').hide();
                  $holder.find('.epsilon-notifybox__success').show();
                  $holder.find('.epsilon-notifybox__success p').html($self.data('success-text'))

                  var $closedHolder = $('#epsilon-notifybox-closed-' + id);

                  if ($closedHolder.length > 0) {
                    $closedHolder.remove();
                  }

                  setTimeout(function () {
                    app.closeNotifybox(id);
                  }, $self.data('close-delay'));

                  if (window.confetti !== undefined) {
                    window.confetti.start();
                    setTimeout(function () {
                      window.confetti.stop();
                    }, 1000);
                  }

                  app.$holder.trigger('enb-notifybox-activated', [id]);

                } else {
                  alert(Array.isArray(resp.data) ? resp.data.join('\n') : resp.data)
                }
              },
              error: function (xhr, ajaxOptions, thrownError) {
                console.log('error...', xhr);
              },
              complete: function () {
                $self.removeClass('loading');
              }
            });
          });
        }
      },

      countdown: {

        init: function () {

          $('.epsilon-notifybox .enb-countdown').each(function () {

            var $self = $(this),
              $days = $self.find('.enb-days'),
              $hours = $self.find('.enb-hours'),
              $minutes = $self.find('.enb-minutes'),
              $seconds = $self.find('.enb-seconds'),
              countDownDate = new Date($self.data('date')).getTime();

            if (!countDownDate) {
              return;
            }

            var interval = setInterval(function () {

              var now = new Date().getTime(),
                distance = countDownDate - now;

              // Time calculations for days, hours, minutes and seconds.
              var days = Math.floor(distance / (1000 * 60 * 60 * 24));
              var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
              var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
              var seconds = Math.floor((distance % (1000 * 60)) / 1000);

              $days.html('<b>' + days + '</b>' + app.strN('Tag', 'Tage', days));
              $hours.html('<b>' + hours + '</b>' + 'Std');
              $minutes.html('<b>' + minutes + '</b>' + 'Min');
              $seconds.html('<b>' + seconds + '</b>' + 'Sek');

              if (days === 0) {
                $days.hide();
              }

              if (distance < 0) {
                clearInterval(interval);
                $self.remove();
              } else if (!$self.is(':visible')) {
                $self.show();
              }
            }, 1000);
          });
        },
      },

      contactForm7: {
        init: function () {

          $('.epsilon-notifybox .wpcf7').on('wpcf7mailsent', function () {

            var $self = $(this),
              $holder = $self.closest('.epsilon-notifybox'),
              id = $holder.data('id'),
              $closedHolder = $('#epsilon-notifybox-closed-' + id);

            if ($closedHolder.length > 0) {
              $closedHolder.remove();
            }

            setTimeout(function () {
              app.closeNotifybox(id);
            }, 3000);

            if (window.confetti !== undefined) {
              window.confetti.start();
              setTimeout(function () {
                window.confetti.stop();
              }, 1000);
            }

            app.$holder.trigger('enb-notifybox-activated', [id]);
          });
        }
      }
    },

    strN: function (singular, plural, domain) {
      return domain > 1 ? plural : singular;
    },

    setCookie: function (name, value, options) {
      options = options || {};

      var expires = options.expires;

      if (typeof expires == "number" && expires) {
        var d = new Date();
        d.setTime(d.getTime() + expires * 1000);
        expires = options.expires = d;
      }
      if (expires && expires.toUTCString) {
        options.expires = expires.toUTCString();
      }

      value = encodeURIComponent(value);

      var updatedCookie = name + "=" + value;

      for (var propName in options) {
        updatedCookie += "; " + propName;
        var propValue = options[propName];
        if (propValue !== true) {
          updatedCookie += "=" + propValue;
        }
      }

      document.cookie = updatedCookie;
    },

    getCookie: function (name) {
      var matches = document.cookie.match(new RegExp(
        "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
      ));
      return matches ? decodeURIComponent(matches[1]) : undefined;
    },

    isUserLoggedIn: function () {
      return app.getCookie(settings.sessionKey) === 'true';
    }
  };

  // Start app.
  app.init();

}(document, window, jQuery, window.epsilonNotifybox));
